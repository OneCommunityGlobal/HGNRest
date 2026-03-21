jest.mock('mongoose', () => ({
  Types: {
    ObjectId: Object.assign(
      jest.fn((id) => id),
      {
        isValid: jest.fn(),
      },
    ),
  },
}));

jest.mock('regression', () => ({ linear: jest.fn() }));

jest.mock('../../models/bmdashboard/projectRiskProfile', () => ({ findOne: jest.fn() }));

jest.mock('../../utilities/nodeCache', () => ({
  hasCache: jest.fn(),
  getCache: jest.fn(),
  setCache: jest.fn(),
}));

const mongoose = require('mongoose');
const regression = require('regression');
const ProjectRiskProfile = require('../../models/bmdashboard/projectRiskProfile');
const cache = require('../../utilities/nodeCache');
const {
  classifyUtilization,
  calculateCheckedOutHours,
  buildToolFilter,
  parseDateRange,
  groupToolsByType,
  calculateGroupUtilization,
  buildCacheKey,
  computeUtilizationData,
  bucketUtilizationByWeek,
  forecastUtilization,
  generateMaintenanceAlerts,
  generateResourceBalancingSuggestions,
  generateRecommendations,
  stripInternalDetails,
  buildInsightsSummary,
  determineForecastDays,
  buildUtilizationResponse,
  buildReportPayload,
} = require('../toolUtilizationHelpers');

// ─── Shared fixtures ───
const makeLog = (type, dateStr) => ({ type, date: new Date(dateStr) });

const JAN1 = new Date('2026-01-01T00:00:00Z');
const JAN31 = new Date('2026-01-31T23:59:59Z');
const JAN_HOURS = (JAN31 - JAN1) / 3600000;

const makeToolItem = (logRecord = [], extra = {}) => ({
  logRecord,
  itemType: { _id: { toString: () => 'type1' }, name: 'Power Drill' },
  purchaseStatus: 'Purchased',
  condition: 'Good',
  currentUsage: 'Available',
  ...extra,
});

const makeUtilizationItem = (
  name,
  rate,
  purchaseStatuses = [],
  conditions = [],
  currentUsages = [],
) => ({
  name,
  utilizationRate: rate,
  downtime: 100,
  classification: classifyUtilization(rate),
  toolCount: purchaseStatuses.length || 2,
  totalCheckedOutHours: rate * 0.72,
  totalPossibleHours: 720,
  toolGroupDetails: {
    tools: purchaseStatuses.map(() => ({})),
    purchaseStatuses,
    conditions,
    currentUsages,
  },
});

const makeMockBuildingTool = (tools = []) => {
  const lean = jest.fn().mockResolvedValue(tools);
  const chain = { populate: jest.fn(), lean };
  chain.populate.mockReturnValue(chain);
  return { BuildingTool: { find: jest.fn().mockReturnValue(chain) }, lean };
};

beforeEach(() => {
  jest.clearAllMocks();
  mongoose.Types.ObjectId.isValid.mockReturnValue(true);
  cache.hasCache.mockReturnValue(false);
  regression.linear.mockReturnValue({
    r2: 0.8,
    predict: jest.fn().mockImplementation((i) => [i, 60]),
  });
});

// ─── classifyUtilization ───
describe('classifyUtilization', () => {
  it('returns Under-utilized and yellow for rate 0', () => {
    expect(classifyUtilization(0)).toEqual({ label: 'Under-utilized', trafficLight: 'yellow' });
  });

  it('returns Under-utilized and yellow for rate 54', () => {
    expect(classifyUtilization(54)).toEqual({ label: 'Under-utilized', trafficLight: 'yellow' });
  });

  it('returns Normal and green for rate 55', () => {
    expect(classifyUtilization(55)).toEqual({ label: 'Normal', trafficLight: 'green' });
  });

  it('returns Normal and green for rate 85', () => {
    expect(classifyUtilization(85)).toEqual({ label: 'Normal', trafficLight: 'green' });
  });

  it('returns Over-utilized and red for rate 86', () => {
    expect(classifyUtilization(86)).toEqual({ label: 'Over-utilized', trafficLight: 'red' });
  });

  it('returns Over-utilized and red for rate 100', () => {
    expect(classifyUtilization(100)).toEqual({ label: 'Over-utilized', trafficLight: 'red' });
  });
});

// ─── calculateCheckedOutHours ───
describe('calculateCheckedOutHours', () => {
  it('returns 0 when logRecord is undefined', () => {
    expect(calculateCheckedOutHours({ logRecord: undefined }, JAN1, JAN31)).toBe(0);
  });

  it('returns 0 when no logs fall within period and only a prior checkin exists', () => {
    const toolWithCheckin = makeToolItem([makeLog('Check In', '2025-12-15T00:00:00Z')]);
    expect(calculateCheckedOutHours(toolWithCheckin, JAN1, JAN31)).toBe(0);
  });

  it('returns full period hours when no logs in period and last prior log is Check Out', () => {
    const tool = makeToolItem([makeLog('Check Out', '2025-12-15T00:00:00Z')]);
    const result = calculateCheckedOutHours(tool, JAN1, JAN31);
    expect(result).toBeCloseTo(JAN_HOURS, 0);
  });

  it('returns 0 when no logs in period and last prior log is Check In', () => {
    const tool = makeToolItem([
      makeLog('Check Out', '2025-12-01T00:00:00Z'),
      makeLog('Check In', '2025-12-15T00:00:00Z'),
    ]);
    expect(calculateCheckedOutHours(tool, JAN1, JAN31)).toBe(0);
  });

  it('returns hours between Check Out and Check In within period', () => {
    const checkOut = new Date('2026-01-05T08:00:00Z');
    const checkIn = new Date('2026-01-05T12:00:00Z');
    const tool = makeToolItem([makeLog('Check Out', checkOut), makeLog('Check In', checkIn)]);
    expect(calculateCheckedOutHours(tool, JAN1, JAN31)).toBeCloseTo(4, 5);
  });

  it('counts time to period end when Check Out has no matching Check In', () => {
    const checkOut = new Date('2026-01-31T20:00:00Z');
    const tool = makeToolItem([makeLog('Check Out', checkOut)]);
    const expected = (JAN31 - checkOut) / 3600000;
    expect(calculateCheckedOutHours(tool, JAN1, JAN31)).toBeCloseTo(expected, 5);
  });

  it('ignores orphan Check In with no preceding Check Out', () => {
    const tool = makeToolItem([makeLog('Check In', '2026-01-10T10:00:00Z')]);
    expect(calculateCheckedOutHours(tool, JAN1, JAN31)).toBe(0);
  });

  it('accumulates multiple checkout/checkin pairs', () => {
    const logs = [
      makeLog('Check Out', '2026-01-05T08:00:00Z'),
      makeLog('Check In', '2026-01-05T10:00:00Z'), // 2 hours
      makeLog('Check Out', '2026-01-10T06:00:00Z'),
      makeLog('Check In', '2026-01-10T10:00:00Z'), // 4 hours
    ];
    const tool = makeToolItem(logs);
    expect(calculateCheckedOutHours(tool, JAN1, JAN31)).toBeCloseTo(6, 5);
  });
});

// ─── buildToolFilter ───
describe('buildToolFilter', () => {
  it('returns only __t filter when no params', () => {
    expect(buildToolFilter({})).toEqual({ __t: 'tool_item' });
  });

  it('ignores tool when tool is ALL', () => {
    expect(buildToolFilter({ tool: 'ALL' })).toEqual({ __t: 'tool_item' });
  });

  it('ignores tool when ObjectId is invalid', () => {
    mongoose.Types.ObjectId.isValid.mockReturnValue(false);
    expect(buildToolFilter({ tool: 'invalid-id' })).toEqual({ __t: 'tool_item' });
  });

  it('adds itemType when tool is a valid ObjectId', () => {
    const result = buildToolFilter({ tool: 'abc123' });
    expect(result.__t).toBe('tool_item');
    expect(result.itemType).toBeDefined();
  });

  it('ignores project when project is ALL', () => {
    expect(buildToolFilter({ project: 'ALL' })).toEqual({ __t: 'tool_item' });
  });

  it('adds both itemType and project when both are valid ObjectIds', () => {
    const result = buildToolFilter({ tool: 'tool1', project: 'proj1' });
    expect(result.itemType).toBeDefined();
    expect(result.project).toBeDefined();
  });
});

// ─── parseDateRange ───
describe('parseDateRange', () => {
  it('defaults to last 30 days when no dates provided', () => {
    const before = Date.now();
    const { rangeEnd, totalHours } = parseDateRange(undefined, undefined);
    const after = Date.now();
    expect(rangeEnd.getTime()).toBeGreaterThanOrEqual(before);
    expect(rangeEnd.getTime()).toBeLessThanOrEqual(after);
    // 30 calendar days ≈ 719–721 hours depending on DST transitions
    expect(totalHours).toBeGreaterThanOrEqual(29 * 24);
    expect(totalHours).toBeLessThanOrEqual(31 * 24);
  });

  it('uses provided startDate', () => {
    const { rangeStart } = parseDateRange('2026-01-01', undefined);
    expect(rangeStart.toISOString().startsWith('2026-01-01')).toBe(true);
  });

  it('uses provided endDate', () => {
    const { rangeEnd } = parseDateRange(undefined, '2026-02-01');
    expect(rangeEnd.toISOString().startsWith('2026-02-01')).toBe(true);
  });

  it('computes totalHours correctly when both dates provided', () => {
    const { totalHours } = parseDateRange('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z');
    expect(totalHours).toBeCloseTo(24, 5);
  });
});

// ─── groupToolsByType ───
describe('groupToolsByType', () => {
  it('returns empty object for empty tools array', () => {
    expect(groupToolsByType([])).toEqual({});
  });

  it('skips tools without itemType', () => {
    const tool = { logRecord: [] }; // no itemType
    expect(groupToolsByType([tool])).toEqual({});
  });

  it('groups multiple tools of the same type under one key', () => {
    const tool1 = makeToolItem();
    const tool2 = makeToolItem();
    const groups = groupToolsByType([tool1, tool2]);
    expect(Object.keys(groups)).toHaveLength(1);
    expect(groups.type1.tools).toHaveLength(2);
  });

  it('creates separate groups for different types', () => {
    const tool1 = makeToolItem([], {
      itemType: { _id: { toString: () => 'typeA' }, name: 'Drill' },
    });
    const tool2 = makeToolItem([], {
      itemType: { _id: { toString: () => 'typeB' }, name: 'Hammer' },
    });
    const groups = groupToolsByType([tool1, tool2]);
    expect(Object.keys(groups)).toHaveLength(2);
  });
});

// ─── calculateGroupUtilization ───
describe('calculateGroupUtilization', () => {
  it('returns utilizationRate of 0 when totalHours is 0', () => {
    const group = { name: 'Drill', tools: [makeToolItem()] };
    const result = calculateGroupUtilization(group, JAN1, JAN1, 0);
    expect(result.utilizationRate).toBe(0);
  });

  it('computes correct utilization rate and downtime for normal case', () => {
    const checkOut = new Date('2026-01-15T00:00:00Z');
    const checkIn = new Date('2026-01-16T00:00:00Z'); // 24 hours checked out
    const tool = makeToolItem([makeLog('Check Out', checkOut), makeLog('Check In', checkIn)]);
    const result = calculateGroupUtilization(
      { name: 'Drill', tools: [tool] },
      JAN1,
      JAN31,
      JAN_HOURS,
    );
    expect(result.utilizationRate).toBeGreaterThan(0);
    expect(result.downtime).toBeGreaterThanOrEqual(0);
    expect(result.classification).toBeDefined();
  });

  it('collects purchaseStatuses, conditions, and currentUsages from tools', () => {
    const tool1 = makeToolItem([], {
      purchaseStatus: 'Purchased',
      condition: 'Worn',
      currentUsage: 'Under Maintenance',
    });
    const tool2 = makeToolItem([], {
      purchaseStatus: 'Rental',
      condition: 'Good',
      currentUsage: 'Available',
    });
    const result = calculateGroupUtilization(
      { name: 'Drill', tools: [tool1, tool2] },
      JAN1,
      JAN31,
      JAN_HOURS,
    );
    expect(result.toolGroupDetails.purchaseStatuses).toEqual(['Purchased', 'Rental']);
    expect(result.toolGroupDetails.conditions).toEqual(['Worn', 'Good']);
    expect(result.toolGroupDetails.currentUsages).toEqual(['Under Maintenance', 'Available']);
  });

  it('includes toolCount and totalCheckedOutHours in result', () => {
    const group = { name: 'Drill', tools: [makeToolItem(), makeToolItem()] };
    const result = calculateGroupUtilization(group, JAN1, JAN31, JAN_HOURS);
    expect(result.toolCount).toBe(2);
    expect(result.totalCheckedOutHours).toBeGreaterThanOrEqual(0);
    expect(result.totalPossibleHours).toBeCloseTo(JAN_HOURS * 2, 0);
  });
});

// ─── buildCacheKey ───
describe('buildCacheKey', () => {
  it('builds full key from all params', () => {
    expect(
      buildCacheKey({ tool: 't1', project: 'p1', startDate: '2026-01-01', endDate: '2026-01-31' }),
    ).toBe('toolUtil:t1:p1:2026-01-01:2026-01-31');
  });

  it('uses ALL and default when params are absent', () => {
    expect(buildCacheKey({})).toBe('toolUtil:ALL:ALL:default:default');
  });

  it('fills in defaults for missing params only', () => {
    expect(buildCacheKey({ tool: 'myTool' })).toBe('toolUtil:myTool:ALL:default:default');
  });
});

// ─── computeUtilizationData ───
describe('computeUtilizationData', () => {
  it('returns cached result without querying DB when cache hits', async () => {
    const cached = {
      utilizationData: [],
      rangeStart: JAN1,
      rangeEnd: JAN31,
      totalHours: JAN_HOURS,
    };
    cache.hasCache.mockReturnValue(true);
    cache.getCache.mockReturnValue(cached);

    const { BuildingTool } = makeMockBuildingTool([]);
    const result = await computeUtilizationData(BuildingTool, {});

    expect(result).toBe(cached);
    expect(BuildingTool.find).not.toHaveBeenCalled();
  });

  it('queries DB and caches result on cache miss', async () => {
    const tool = makeToolItem([], { itemType: { _id: { toString: () => 'id1' }, name: 'Drill' } });
    const { BuildingTool } = makeMockBuildingTool([tool]);

    const result = await computeUtilizationData(BuildingTool, {});

    expect(BuildingTool.find).toHaveBeenCalled();
    expect(cache.setCache).toHaveBeenCalled();
    expect(result.utilizationData).toHaveLength(1);
  });

  it('returns empty utilizationData when no tools found', async () => {
    const { BuildingTool } = makeMockBuildingTool([]);
    const result = await computeUtilizationData(BuildingTool, {});
    expect(result.utilizationData).toHaveLength(0);
  });

  it('sorts utilizationData by utilizationRate descending', async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 3600000);
    const highUseTool = makeToolItem(
      [makeLog('Check Out', thirtyDaysAgo), makeLog('Check In', now)],
      { itemType: { _id: { toString: () => 'highId' }, name: 'Hammer' } },
    );
    const lowUseTool = makeToolItem([], {
      itemType: { _id: { toString: () => 'lowId' }, name: 'Shovel' },
    });
    const { BuildingTool } = makeMockBuildingTool([lowUseTool, highUseTool]);

    const result = await computeUtilizationData(BuildingTool, {});

    expect(result.utilizationData[0].utilizationRate).toBeGreaterThanOrEqual(
      result.utilizationData[1].utilizationRate,
    );
  });
});

// ─── bucketUtilizationByWeek ───
describe('bucketUtilizationByWeek', () => {
  const toolGroup = { tools: [makeToolItem()] };

  it('returns 1 bucket when range is less than one week', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-03T00:00:00Z'); // 2 days
    const buckets = bucketUtilizationByWeek(toolGroup, start, end);
    expect(buckets).toHaveLength(1);
  });

  it('returns 2 buckets for a 14-day range', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-15T00:00:00Z');
    const buckets = bucketUtilizationByWeek(toolGroup, start, end);
    expect(buckets).toHaveLength(2);
  });

  it('returns 5 buckets for a 30-day range', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-31T00:00:00Z');
    const buckets = bucketUtilizationByWeek(toolGroup, start, end);
    expect(buckets).toHaveLength(5);
  });

  it('each bucket has weekIndex, weekStart, weekEnd, and utilizationRate', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-15T00:00:00Z');
    const buckets = bucketUtilizationByWeek(toolGroup, start, end);
    buckets.forEach((bucket, i) => {
      expect(bucket.weekIndex).toBe(i);
      expect(bucket.weekStart).toBeInstanceOf(Date);
      expect(bucket.weekEnd).toBeInstanceOf(Date);
      expect(typeof bucket.utilizationRate).toBe('number');
    });
  });
});

// ─── forecastUtilization ───
describe('forecastUtilization', () => {
  const makeWeeklyBuckets = (count, rate = 50) =>
    Array.from({ length: count }, (_, i) => ({
      weekIndex: i,
      weekStart: new Date(Date.now() - (count - i) * 7 * 24 * 3600000),
      weekEnd: new Date(Date.now() - (count - i - 1) * 7 * 24 * 3600000),
      utilizationRate: rate,
    }));

  it('returns predictedRate 0 and method average for empty buckets', () => {
    const result = forecastUtilization([], 30);
    expect(result.predictedRate).toBe(0);
    expect(result.method).toBe('average');
    expect(result.confidence).toBe('low');
  });

  it('uses average method when fewer than 3 buckets', () => {
    const result = forecastUtilization(makeWeeklyBuckets(2, 60), 30);
    expect(result.method).toBe('average');
    expect(result.predictedRate).toBe(60);
    expect(result.confidence).toBe('low');
  });

  it('uses average when exactly 1 bucket', () => {
    const result = forecastUtilization(makeWeeklyBuckets(1, 40), 30);
    expect(result.method).toBe('average');
    expect(result.predictedRate).toBe(40);
  });

  it('uses ensemble method with high confidence for r2 >= 0.7', () => {
    regression.linear.mockReturnValue({ r2: 0.8, predict: jest.fn().mockReturnValue([0, 65]) });
    const result = forecastUtilization(makeWeeklyBuckets(4, 60), 30);
    expect(result.method).toBe('ensemble');
    expect(result.confidence).toBe('high');
  });

  it('uses ensemble with medium confidence for r2 between 0.4 and 0.7', () => {
    regression.linear.mockReturnValue({ r2: 0.5, predict: jest.fn().mockReturnValue([0, 55]) });
    const result = forecastUtilization(makeWeeklyBuckets(4, 50), 30);
    expect(result.method).toBe('ensemble');
    expect(result.confidence).toBe('medium');
  });

  it('uses ensemble with low confidence for r2 below 0.4', () => {
    regression.linear.mockReturnValue({ r2: 0.2, predict: jest.fn().mockReturnValue([0, 50]) });
    const result = forecastUtilization(makeWeeklyBuckets(4, 50), 30);
    expect(result.confidence).toBe('low');
  });

  it('clamps blended prediction to 0 when regression predicts very low', () => {
    regression.linear.mockReturnValue({ r2: 0.9, predict: jest.fn().mockReturnValue([0, -100]) });
    const result = forecastUtilization(makeWeeklyBuckets(4, 0), 30);
    result.weeklyPredictions.forEach((w) => {
      expect(w.predictedRate).toBeGreaterThanOrEqual(0);
    });
  });

  it('clamps blended prediction to 100 when regression predicts very high', () => {
    regression.linear.mockReturnValue({ r2: 0.9, predict: jest.fn().mockReturnValue([0, 200]) });
    const result = forecastUtilization(makeWeeklyBuckets(4, 100), 30);
    result.weeklyPredictions.forEach((w) => {
      expect(w.predictedRate).toBeLessThanOrEqual(100);
    });
  });

  it('returns ISO forecastEndDate and predictedClassification', () => {
    const result = forecastUtilization(makeWeeklyBuckets(2, 50), 30);
    expect(() => new Date(result.forecastEndDate)).not.toThrow();
    expect(result.predictedClassification).toHaveProperty('label');
    expect(result.predictedClassification).toHaveProperty('trafficLight');
  });
});

// ─── generateMaintenanceAlerts ───
describe('generateMaintenanceAlerts', () => {
  it('returns no alerts for a normal tool', () => {
    const data = [makeUtilizationItem('Drill', 70, ['Purchased'], ['Good'], ['Available'])];
    expect(generateMaintenanceAlerts(data)).toHaveLength(0);
  });

  it('generates overuse alert when rate exceeds 85', () => {
    const data = [makeUtilizationItem('Drill', 90, ['Purchased'], ['Good'], ['Available'])];
    const alerts = generateMaintenanceAlerts(data);
    const overuseAlert = alerts.find((a) => a.alertType === 'overuse');
    expect(overuseAlert).toBeDefined();
    expect(overuseAlert.urgency).toBe('high');
    expect(overuseAlert.message).toContain('90%');
  });

  it('generates condition alert for degraded tool condition', () => {
    const data = [makeUtilizationItem('Drill', 70, [], ['Worn'], [])];
    const alerts = generateMaintenanceAlerts(data);
    expect(alerts.find((a) => a.alertType === 'condition')).toBeDefined();
  });

  it('deduplicates condition alerts for same condition appearing twice', () => {
    const data = [makeUtilizationItem('Drill', 70, [], ['Worn', 'Worn'], [])];
    const conditionAlerts = generateMaintenanceAlerts(data).filter(
      (a) => a.alertType === 'condition',
    );
    expect(conditionAlerts).toHaveLength(1);
  });

  it('does not generate condition alert for Good condition', () => {
    const data = [makeUtilizationItem('Drill', 70, [], ['Good'], [])];
    expect(generateMaintenanceAlerts(data).filter((a) => a.alertType === 'condition')).toHaveLength(
      0,
    );
  });

  it('generates non_operational alert when tool is Under Maintenance', () => {
    const data = [makeUtilizationItem('Drill', 70, [], [], ['Under Maintenance'])];
    const alerts = generateMaintenanceAlerts(data);
    const nonOpAlert = alerts.find((a) => a.alertType === 'non_operational');
    expect(nonOpAlert).toBeDefined();
    expect(nonOpAlert.urgency).toBe('medium');
    expect(nonOpAlert.message).toContain('1 unit(s)');
  });

  it('counts multiple non-operational units in single alert per status', () => {
    const data = [
      makeUtilizationItem('Drill', 70, [], [], ['Under Maintenance', 'Under Maintenance']),
    ];
    const nonOpAlerts = generateMaintenanceAlerts(data).filter(
      (a) => a.alertType === 'non_operational',
    );
    expect(nonOpAlerts).toHaveLength(1);
    expect(nonOpAlerts[0].message).toContain('2 unit(s)');
  });
});

// ─── generateResourceBalancingSuggestions ───
describe('generateResourceBalancingSuggestions', () => {
  it('returns no suggestions for all-normal tools', () => {
    const data = [makeUtilizationItem('Drill', 70), makeUtilizationItem('Hammer', 65)];
    expect(generateResourceBalancingSuggestions(data)).toHaveLength(0);
  });

  it('suggests redistribution when over and under-utilized tools coexist', () => {
    const data = [makeUtilizationItem('Drill', 90), makeUtilizationItem('Wheelbarrow', 30)];
    const suggestions = generateResourceBalancingSuggestions(data);
    expect(suggestions.find((s) => s.suggestion.includes('redistributing'))).toBeDefined();
  });

  it('pairs over-utilized with the least-used under-utilized tool', () => {
    const data = [
      makeUtilizationItem('Drill', 90),
      makeUtilizationItem('Shovel', 40),
      makeUtilizationItem('Wheelbarrow', 20),
    ];
    const suggestions = generateResourceBalancingSuggestions(data);
    const redist = suggestions.find((s) => s.suggestion.includes('redistributing'));
    expect(redist.toTool).toBe('Wheelbarrow');
  });

  it('suggests purchasing when over-utilized tool is mostly rented', () => {
    const data = [makeUtilizationItem('Drill', 90, ['Rental', 'Rental', 'Purchased'])];
    const suggestions = generateResourceBalancingSuggestions(data);
    expect(suggestions.find((s) => s.suggestion.includes('purchasing additional'))).toBeDefined();
  });

  it('suggests renting when under-utilized tool is mostly owned', () => {
    const data = [makeUtilizationItem('Shovel', 30, ['Purchased', 'Purchased', 'Rental'])];
    const suggestions = generateResourceBalancingSuggestions(data);
    expect(suggestions.find((s) => s.suggestion.includes('renting instead'))).toBeDefined();
  });

  it('no redistribution suggestion when over-utilized has no under-utilized counterpart', () => {
    const data = [makeUtilizationItem('Drill', 90, ['Purchased', 'Purchased'])];
    const suggestions = generateResourceBalancingSuggestions(data);
    expect(suggestions.find((s) => s.suggestion.includes('redistributing'))).toBeUndefined();
  });
});

// ─── generateRecommendations ───
describe('generateRecommendations', () => {
  it('recommends review for under-utilized tool', () => {
    const result = generateRecommendations([makeUtilizationItem('Shovel', 30)]);
    expect(result[0].action).toContain('Potentially removable');
    expect(result[0].toolName).toBe('Shovel');
    expect(result[0].trafficLight).toBe('yellow');
  });

  it('recommends no action for normal tool', () => {
    const result = generateRecommendations([makeUtilizationItem('Drill', 70)]);
    expect(result[0].action).toContain('Normal operation');
    expect(result[0].trafficLight).toBe('green');
  });

  it('recommends maintenance planning for over-utilized tool', () => {
    const result = generateRecommendations([makeUtilizationItem('Crane', 90)]);
    expect(result[0].action).toContain('Requires maintenance scheduling');
    expect(result[0].trafficLight).toBe('red');
  });
});

// ─── stripInternalDetails ───
describe('stripInternalDetails', () => {
  it('removes toolGroupDetails from item', () => {
    const item = { name: 'Drill', utilizationRate: 75, toolGroupDetails: { tools: [] } };
    const result = stripInternalDetails(item);
    expect(result.toolGroupDetails).toBeUndefined();
  });

  it('preserves all other public fields', () => {
    const item = {
      name: 'Drill',
      utilizationRate: 75,
      downtime: 100,
      classification: { label: 'Normal', trafficLight: 'green' },
      toolCount: 2,
      toolGroupDetails: { tools: [] },
    };
    const result = stripInternalDetails(item);
    expect(result.name).toBe('Drill');
    expect(result.utilizationRate).toBe(75);
    expect(result.downtime).toBe(100);
    expect(result.classification).toBeDefined();
    expect(result.toolCount).toBe(2);
  });
});

// ─── buildInsightsSummary ───
describe('buildInsightsSummary', () => {
  it('returns all zeros for empty array', () => {
    const result = buildInsightsSummary([]);
    expect(result).toEqual({
      totalToolTypes: 0,
      underUtilized: 0,
      normal: 0,
      overUtilized: 0,
      averageUtilization: 0,
    });
  });

  it('counts all as normal when all tools are normal', () => {
    const data = [makeUtilizationItem('A', 60), makeUtilizationItem('B', 75)];
    const result = buildInsightsSummary(data);
    expect(result.normal).toBe(2);
    expect(result.underUtilized).toBe(0);
    expect(result.overUtilized).toBe(0);
  });

  it('correctly counts mixed utilization categories', () => {
    const data = [
      makeUtilizationItem('A', 30), // under
      makeUtilizationItem('B', 70), // normal
      makeUtilizationItem('C', 90), // over
    ];
    const result = buildInsightsSummary(data);
    expect(result.underUtilized).toBe(1);
    expect(result.normal).toBe(1);
    expect(result.overUtilized).toBe(1);
    expect(result.totalToolTypes).toBe(3);
  });

  it('computes averageUtilization as rounded mean', () => {
    const data = [makeUtilizationItem('A', 60), makeUtilizationItem('B', 80)];
    const result = buildInsightsSummary(data);
    expect(result.averageUtilization).toBe(70);
  });
});

// ─── determineForecastDays ───
describe('determineForecastDays', () => {
  it('returns 30 days with no warning for forecast30 mode', async () => {
    const result = await determineForecastDays('forecast30', 'anyId');
    expect(result.forecastDays).toBe(30);
    expect(result.warning).toBeNull();
  });

  it('returns 30 days with warning when no projectId for forecastFull', async () => {
    const result = await determineForecastDays('forecastFull', undefined);
    expect(result.forecastDays).toBe(30);
    expect(result.warning).toContain('No specific project');
  });

  it('returns 30 days with warning when projectId is ALL', async () => {
    const result = await determineForecastDays('forecastFull', 'ALL');
    expect(result.forecastDays).toBe(30);
    expect(result.warning).toBeTruthy();
  });

  it('returns 30 days with warning when no risk profile found', async () => {
    ProjectRiskProfile.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const result = await determineForecastDays('forecastFull', 'validProjectId');
    expect(result.forecastDays).toBe(30);
    expect(result.warning).toContain('No project schedule');
  });

  it('returns 30 days with warning when risk profile has no endDate', async () => {
    ProjectRiskProfile.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ projectId: 'p1' }),
    });
    const result = await determineForecastDays('forecastFull', 'validProjectId');
    expect(result.forecastDays).toBe(30);
    expect(result.warning).toBeTruthy();
  });

  it('returns calculated days when risk profile has a future endDate', async () => {
    const futureDate = new Date(Date.now() + 60 * 24 * 3600000);
    ProjectRiskProfile.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ endDate: futureDate }),
    });
    const result = await determineForecastDays('forecastFull', 'validProjectId');
    expect(result.forecastDays).toBeGreaterThan(50);
    expect(result.warning).toBeNull();
  });

  it('enforces minimum of 7 days when endDate is very soon', async () => {
    const nearDate = new Date(Date.now() + 2 * 24 * 3600000);
    ProjectRiskProfile.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ endDate: nearDate }),
    });
    const result = await determineForecastDays('forecastFull', 'validProjectId');
    expect(result.forecastDays).toBe(7);
  });
});

// ─── buildUtilizationResponse ───
describe('buildUtilizationResponse', () => {
  const rangeStart = new Date('2026-01-01T00:00:00Z');
  const rangeEnd = new Date('2026-01-22T00:00:00Z'); // 21 days → 3 weekly buckets

  const makeItem = (name, rate) => ({
    ...makeUtilizationItem(name, rate),
    toolGroupDetails: {
      tools: [makeToolItem()],
      purchaseStatuses: [],
      conditions: [],
      currentUsages: [],
    },
  });

  it('sets forecast to null in historical mode', async () => {
    const data = [makeItem('Drill', 70)];
    const result = await buildUtilizationResponse({
      utilizationData: data,
      rangeStart,
      rangeEnd,
      selectedMode: 'historical',
      project: null,
    });
    expect(result[0].forecast).toBeNull();
    expect(result[0].toolGroupDetails).toBeUndefined();
  });

  it('attaches forecast object in forecast30 mode', async () => {
    const data = [makeItem('Drill', 70)];
    const result = await buildUtilizationResponse({
      utilizationData: data,
      rangeStart,
      rangeEnd,
      selectedMode: 'forecast30',
      project: null,
    });
    expect(result[0].forecast).not.toBeNull();
    expect(result[0].forecast).toHaveProperty('predictedRate');
    expect(result[0].forecast).toHaveProperty('weeklyPredictions');
  });

  it('adds warning to all items when no project selected in forecastFull', async () => {
    const data = [makeItem('Drill', 70), makeItem('Hammer', 50)];
    const result = await buildUtilizationResponse({
      utilizationData: data,
      rangeStart,
      rangeEnd,
      selectedMode: 'forecastFull',
      project: null,
    });
    expect(result[0].warning).toBeTruthy();
    expect(result[1].warning).toBeTruthy();
  });

  it('does not add warning when valid project has a risk profile', async () => {
    const futureDate = new Date(Date.now() + 60 * 24 * 3600000);
    ProjectRiskProfile.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ endDate: futureDate }),
    });
    const data = [makeItem('Drill', 70)];
    const result = await buildUtilizationResponse({
      utilizationData: data,
      rangeStart,
      rangeEnd,
      selectedMode: 'forecastFull',
      project: 'validProjectId',
    });
    expect(result[0].warning).toBeUndefined();
  });

  it('strips toolGroupDetails from all response items', async () => {
    const data = [makeItem('Drill', 70)];
    const result = await buildUtilizationResponse({
      utilizationData: data,
      rangeStart,
      rangeEnd,
      selectedMode: 'historical',
      project: null,
    });
    expect(result[0].toolGroupDetails).toBeUndefined();
  });
});

// ─── buildReportPayload ───
describe('buildReportPayload', () => {
  const rangeStart = new Date('2026-01-01T00:00:00Z');
  const rangeEnd = new Date('2026-01-31T00:00:00Z');

  it('returns object with all required keys', () => {
    const data = [makeUtilizationItem('Drill', 70)];
    const result = buildReportPayload(data, rangeStart, rangeEnd, 'proj1');
    expect(result).toHaveProperty('utilizationData');
    expect(result).toHaveProperty('alerts');
    expect(result).toHaveProperty('balancing');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('metadata');
  });

  it('builds metadata with correct dateRange and projectFilter', () => {
    const data = [makeUtilizationItem('Drill', 70)];
    const result = buildReportPayload(data, rangeStart, rangeEnd, 'myProject');
    expect(result.metadata.dateRange).toContain(rangeStart.toISOString());
    expect(result.metadata.dateRange).toContain(rangeEnd.toISOString());
    expect(result.metadata.projectFilter).toBe('myProject');
  });

  it('defaults projectFilter to ALL when project is not provided', () => {
    const data = [];
    const result = buildReportPayload(data, rangeStart, rangeEnd, undefined);
    expect(result.metadata.projectFilter).toBe('ALL');
  });
});
