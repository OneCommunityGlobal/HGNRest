const VALID_PROJECT_ID = '507f1f77bcf86cd799439011';
const CURRENT_START = '2026-08-30';
const CURRENT_END = '2026-09-05';
const COMPARISON_START = '2026-08-23';
const COMPARISON_END = '2026-08-29';
const PAST_START = '2026-08-16';
const PAST_END = '2026-08-22';
const HOUR_MS = 60 * 60 * 1000;
const CURRENT_ONLY_METRICS = ['activeProjects', 'delayedProjects', 'materialAvailable'];
const PROJECT_STATUS_METRICS = [
  'totalProjects',
  'completedProjects',
  'activeProjects',
  'delayedProjects',
  'avgProjectDuration',
];

jest.mock('../../models/bmdashboard/buildingMaterial', () => ({
  aggregate: jest.fn(),
}));
jest.mock('../../models/bmdashboard/buildingProject', () => ({
  findById: jest.fn(),
}));
jest.mock('../../models/bmdashboard/buildingTimeLogger', () => ({
  aggregate: jest.fn(),
}));
jest.mock('../../models/laborCost', () => ({
  aggregate: jest.fn(),
}));
jest.mock('../../models/projectStatus', () => ({
  aggregate: jest.fn(),
}));

const BuildingMaterial = require('../../models/bmdashboard/buildingMaterial');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const BuildingTimeLog = require('../../models/bmdashboard/buildingTimeLogger');
const LaborCost = require('../../models/laborCost');
const ProjectStatus = require('../../models/projectStatus');
const {
  COMPARISON_TYPES,
  calculatePercentageChange,
  getWeeklyProjectSummaryProjectStatus,
  testExports: { getProjectStatusAsOf },
} = require('./weeklyProjectSummaryService');

function mockProject(project = { _id: VALID_PROJECT_ID, name: 'One Community' }) {
  BuildingProject.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(project),
    }),
  });
}

function statusRow(totalProjects, completedProjects, delayedProjects, avgDurationMs) {
  return { totalProjects, completedProjects, delayedProjects, avgDurationMs };
}

function mockAggregates({
  statusRows = [statusRow(7, 2, 1, 36 * HOUR_MS)],
  usageRows = [{ totalMaterialUsed: 20, materialWasted: 5 }],
  purchaseRows = [{ totalMaterialCost: 100 }],
  availableRows = [{ materialAvailable: 50 }],
  laborRows = [{ totalLaborCost: 75 }],
  laborHourRows = [{ totalElapsedTime: 10 * HOUR_MS }],
} = {}) {
  ProjectStatus.aggregate.mockResolvedValueOnce(statusRows);
  BuildingMaterial.aggregate
    .mockResolvedValueOnce(usageRows)
    .mockResolvedValueOnce(purchaseRows)
    .mockResolvedValueOnce(availableRows);
  LaborCost.aggregate.mockResolvedValueOnce(laborRows);
  BuildingTimeLog.aggregate.mockResolvedValueOnce(laborHourRows);
}

const ZERO_ROWS = {
  statusRows: [statusRow(0, 0, 0, 0)],
  usageRows: [{ totalMaterialUsed: 0, materialWasted: 0 }],
  purchaseRows: [{ totalMaterialCost: 0 }],
  laborRows: [{ totalLaborCost: 0 }],
  laborHourRows: [{ totalElapsedTime: 0 }],
};

const EMPTY_PERIOD_ROWS = {
  statusRows: [],
  usageRows: [],
  purchaseRows: [],
  laborRows: [],
  laborHourRows: [],
};

const PERIOD_COMPARABLE_METRICS = [
  'totalProjects',
  'completedProjects',
  'avgProjectDuration',
  'totalMaterialCost',
  'totalMaterialUsed',
  'materialWasted',
  'totalLaborCost',
  'totalLaborHoursInvested',
];

describe('weeklyProjectSummaryService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns current-period metrics without placeholder or fallback values', async () => {
    mockAggregates();

    const result = await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });

    expect(result.projectId).toBe('all');
    expect(result.comparison).toBeNull();
    expect(result.current.metrics.totalProjects).toMatchObject({
      value: 7,
      comparisonType: COMPARISON_TYPES.PERIOD_COMPARABLE,
    });
    expect(result.current.metrics.activeProjects).toMatchObject({
      value: 4,
      comparisonType: COMPARISON_TYPES.CURRENT_ONLY,
      percentageChange: null,
    });
    expect(result.current.metrics.delayedProjects).toMatchObject({
      value: 1,
      comparisonType: COMPARISON_TYPES.CURRENT_ONLY,
    });
    expect(result.current.metrics.completedProjects).toMatchObject({
      value: 2,
      comparisonType: COMPARISON_TYPES.PERIOD_COMPARABLE,
    });
    expect(result.current.metrics.avgProjectDuration).toMatchObject({
      value: 36,
      unit: 'hrs',
    });
    expect(result.current.metrics.totalMaterialCost.value).toBe(100);
    expect(result.current.metrics.totalMaterialUsed.value).toBe(20);
    expect(result.current.metrics.materialWasted.value).toBe(5);
    expect(result.current.metrics.totalLaborCost.value).toBe(75);
    expect(result.current.metrics.totalLaborHoursInvested).toMatchObject({
      value: 10,
      unit: 'hrs',
      comparisonType: COMPARISON_TYPES.PERIOD_COMPARABLE,
    });
    expect(JSON.stringify(result)).not.toContain('426');
    expect(JSON.stringify(result)).not.toContain('27.6');
    expect(JSON.stringify(result)).not.toContain('18.4');
  });

  test('returns current and comparison metrics with percentage changes only for period-comparable metrics', async () => {
    mockAggregates();
    mockAggregates({
      statusRows: [statusRow(5, 1, 1, 18 * HOUR_MS)],
      usageRows: [{ totalMaterialUsed: 10, materialWasted: 10 }],
      purchaseRows: [{ totalMaterialCost: 50 }],
      availableRows: [{ materialAvailable: 45 }],
      laborRows: [{ totalLaborCost: 25 }],
      laborHourRows: [{ totalElapsedTime: 5 * HOUR_MS }],
    });

    const result = await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
      comparisonStartDate: COMPARISON_START,
      comparisonEndDate: COMPARISON_END,
    });

    expect(result.comparison.startDate).toBe(COMPARISON_START);
    expect(result.comparison.metrics.totalProjects.value).toBe(5);
    expect(result.current.metrics.totalProjects).toMatchObject({
      comparisonValue: 5,
      percentageChange: 0.4,
    });
    expect(result.current.metrics.completedProjects.percentageChange).toBe(1);
    expect(result.current.metrics.avgProjectDuration.percentageChange).toBe(1);
    expect(result.current.metrics.totalLaborHoursInvested.percentageChange).toBe(1);
    expect(result.current.metrics.totalMaterialUsed.percentageChange).toBe(1);
    expect(result.current.metrics.totalMaterialCost.percentageChange).toBe(1);
    expect(result.current.metrics.materialWasted.percentageChange).toBe(-0.5);
    expect(result.current.metrics.totalLaborCost.percentageChange).toBe(2);
    CURRENT_ONLY_METRICS.forEach((metricName) => {
      expect(result.current.metrics[metricName].percentageChange).toBeNull();
    });
  });

  test('preserves legitimate zero values when aggregate rows exist', async () => {
    mockAggregates({ ...ZERO_ROWS, availableRows: [{ materialAvailable: 0 }] });

    const result = await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });

    PERIOD_COMPARABLE_METRICS.forEach((metricName) => {
      expect(result.current.metrics[metricName]).toMatchObject({
        value: 0,
        comparisonType: COMPARISON_TYPES.PERIOD_COMPARABLE,
      });
    });
    CURRENT_ONLY_METRICS.forEach((metricName) => {
      expect(result.current.metrics[metricName]).toMatchObject({
        value: 0,
        comparisonType: COMPARISON_TYPES.CURRENT_ONLY,
      });
    });
    expect(result.current.metrics.avgProjectDuration.unit).toBe('hrs');
    expect(result.current.metrics.totalLaborHoursInvested.unit).toBe('hrs');
    expect(result.current.metrics.totalMaterialCost.unit).toBe('USD');
    expect(result.current.metrics.totalLaborCost.unit).toBe('USD');
  });

  test('returns values instead of N/A for past periods that do not include today', async () => {
    mockAggregates();

    const result = await getWeeklyProjectSummaryProjectStatus({
      startDate: PAST_START,
      endDate: PAST_END,
    });

    expect(result.current.metrics.totalProjects).toMatchObject({
      value: 7,
      comparisonType: COMPARISON_TYPES.PERIOD_COMPARABLE,
    });
    expect(result.current.metrics.activeProjects).toMatchObject({
      value: 4,
      comparisonType: COMPARISON_TYPES.CURRENT_ONLY,
      unavailableReason: expect.stringContaining('current Active/Delayed status'),
    });
    expect(result.current.metrics.materialAvailable).toMatchObject({
      value: 50,
      comparisonType: COMPARISON_TYPES.CURRENT_ONLY,
      unavailableReason: expect.stringContaining('current stock'),
    });
    Object.values(result.current.metrics).forEach((metric) => {
      expect(metric.value).not.toBeNull();
    });
  });

  test('counts project status as of the end of the selected period', async () => {
    ProjectStatus.aggregate.mockResolvedValueOnce([statusRow(3, 1, 1, 48 * HOUR_MS)]);

    const stats = await getProjectStatusAsOf(null, PAST_END);
    const [groupStage] = ProjectStatus.aggregate.mock.calls[0][0];
    const endOfPeriod = new Date(2026, 7, 22, 23, 59, 59, 999);

    expect(stats).toEqual({
      totalProjects: 3,
      completedProjects: 1,
      delayedProjects: 1,
      activeProjects: 1,
      avgProjectDuration: 48,
    });
    expect(groupStage.$group.totalProjects).toEqual({
      $sum: { $cond: [{ $lte: ['$startDate', endOfPeriod] }, 1, 0] },
    });
    const completedRule = JSON.stringify(groupStage.$group.completedProjects);
    expect(completedRule).toContain('Completed');
    expect(completedRule).toContain('$completionDate');
  });

  test('marks project status metrics unavailable when there are no ProjectStatus records', async () => {
    mockAggregates({ statusRows: [] });

    const result = await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });

    PROJECT_STATUS_METRICS.forEach((metricName) => {
      expect(result.current.metrics[metricName]).toMatchObject({
        value: null,
        comparisonType: COMPARISON_TYPES.UNAVAILABLE,
        unavailableReason: 'No data exists for the selected period.',
      });
    });
  });

  test('rounds monetary metrics to two decimal places', async () => {
    mockAggregates({
      purchaseRows: [{ totalMaterialCost: 10.005000000000003 }],
      laborRows: [{ totalLaborCost: 20.335000000000004 }],
    });

    const result = await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });

    expect(result.current.metrics.totalMaterialCost).toMatchObject({
      value: 10.01,
      unit: 'USD',
    });
    expect(result.current.metrics.totalLaborCost).toMatchObject({
      value: 20.34,
      unit: 'USD',
    });
  });

  test('marks period-comparable metrics unavailable when current-period source rows are missing', async () => {
    mockAggregates({ ...EMPTY_PERIOD_ROWS, statusRows: [statusRow(7, 0, 1, null)] });

    const result = await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });

    [
      'avgProjectDuration',
      'totalMaterialCost',
      'totalMaterialUsed',
      'materialWasted',
      'totalLaborCost',
      'totalLaborHoursInvested',
    ].forEach((metricName) => {
      expect(result.current.metrics[metricName]).toMatchObject({
        value: null,
        comparisonType: COMPARISON_TYPES.UNAVAILABLE,
        percentageChange: null,
        unavailableReason: 'No data exists for the selected period.',
      });
    });

    expect(result.current.metrics.totalProjects.comparisonType).toBe(
      COMPARISON_TYPES.PERIOD_COMPARABLE,
    );
    expect(result.current.metrics.completedProjects.value).toBe(0);
    CURRENT_ONLY_METRICS.forEach((metricName) => {
      expect(result.current.metrics[metricName].comparisonType).toBe(COMPARISON_TYPES.CURRENT_ONLY);
    });
  });

  test('reports no comparison data when comparison-period source rows are missing', async () => {
    mockAggregates();
    mockAggregates(EMPTY_PERIOD_ROWS);

    const result = await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
      comparisonStartDate: COMPARISON_START,
      comparisonEndDate: COMPARISON_END,
    });

    PERIOD_COMPARABLE_METRICS.forEach((metricName) => {
      expect(result.current.metrics[metricName]).toMatchObject({
        comparisonValue: null,
        percentageChange: 'No Comparison Data',
      });
      expect(result.comparison.metrics[metricName]).toMatchObject({
        value: null,
        comparisonType: COMPARISON_TYPES.UNAVAILABLE,
      });
    });
  });

  test('handles zero comparison values without changing normal comparison behavior', async () => {
    mockAggregates(ZERO_ROWS);
    mockAggregates(ZERO_ROWS);

    const zeroResult = await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
      comparisonStartDate: COMPARISON_START,
      comparisonEndDate: COMPARISON_END,
    });

    PERIOD_COMPARABLE_METRICS.forEach((metricName) => {
      expect(zeroResult.current.metrics[metricName].percentageChange).toBe(0);
    });

    jest.clearAllMocks();
    mockAggregates();
    mockAggregates(ZERO_ROWS);

    const noComparisonDataResult = await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
      comparisonStartDate: COMPARISON_START,
      comparisonEndDate: COMPARISON_END,
    });

    PERIOD_COMPARABLE_METRICS.forEach((metricName) => {
      expect(noComparisonDataResult.current.metrics[metricName].percentageChange).toBe(
        'No Comparison Data',
      );
    });
  });

  test('filters selected projects through BuildingProject id, material project id, and name-based weak mappings', async () => {
    mockProject();
    mockAggregates();

    await getWeeklyProjectSummaryProjectStatus({
      projectId: VALID_PROJECT_ID,
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });

    expect(BuildingProject.findById).toHaveBeenCalledWith(VALID_PROJECT_ID);
    expect(ProjectStatus.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { name: 'One Community' },
    });
    expect(BuildingMaterial.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { project: VALID_PROJECT_ID },
    });
    expect(LaborCost.aggregate.mock.calls[0][0][0].$match.project_name).toBe('One Community');
    expect(BuildingTimeLog.aggregate.mock.calls[0][0][0].$match.project).toBe(VALID_PROJECT_ID);
  });

  test('all-project filtering does not restrict models by project', async () => {
    mockAggregates();

    await getWeeklyProjectSummaryProjectStatus({
      projectId: 'all',
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });

    expect(BuildingProject.findById).not.toHaveBeenCalled();
    expect(ProjectStatus.aggregate.mock.calls[0][0]).toHaveLength(1);
    expect(ProjectStatus.aggregate.mock.calls[0][0][0]).toHaveProperty('$group');
    expect(BuildingMaterial.aggregate.mock.calls[0][0][0]).toEqual({ $match: {} });
    expect(LaborCost.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { date: expect.objectContaining({ $gte: expect.any(Date), $lte: expect.any(Date) }) },
    });
    expect(BuildingTimeLog.aggregate.mock.calls[0][0][0].$match).not.toHaveProperty('project');
  });

  test('labor hours use completed time logs created in the selected period', async () => {
    mockAggregates();

    await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });

    expect(BuildingTimeLog.aggregate.mock.calls[0][0]).toEqual([
      {
        $match: {
          status: 'completed',
          totalElapsedTime: { $gt: 0 },
          createdAt: { $gte: expect.any(Date), $lte: expect.any(Date) },
        },
      },
      { $group: { _id: null, totalElapsedTime: { $sum: '$totalElapsedTime' } } },
    ]);
  });

  test('material aggregation uses updateRecord and approved purchaseRecord date ranges', async () => {
    mockAggregates();

    await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });

    const usagePipeline = BuildingMaterial.aggregate.mock.calls[0][0];
    const purchasePipeline = BuildingMaterial.aggregate.mock.calls[1][0];

    expect(usagePipeline).toEqual(
      expect.arrayContaining([
        { $unwind: '$updateRecord' },
        {
          $group: expect.objectContaining({
            totalMaterialUsed: { $sum: '$updateRecord.quantityUsed' },
            materialWasted: { $sum: '$updateRecord.quantityWasted' },
          }),
        },
      ]),
    );
    expect(purchasePipeline).toEqual(
      expect.arrayContaining([
        { $unwind: '$purchaseRecord' },
        {
          $match: expect.objectContaining({
            'purchaseRecord.status': 'Approved',
            'purchaseRecord.date': expect.objectContaining({
              $gte: expect.any(Date),
              $lte: expect.any(Date),
            }),
          }),
        },
      ]),
    );
  });

  test('throws a 404 error when selected project does not exist', async () => {
    mockProject(null);

    await expect(
      getWeeklyProjectSummaryProjectStatus({
        projectId: VALID_PROJECT_ID,
        startDate: CURRENT_START,
        endDate: CURRENT_END,
      }),
    ).rejects.toMatchObject({ status: 404, message: 'Building project not found' });
  });

  test('calculates numeric percentage changes', () => {
    expect(calculatePercentageChange(0, 0)).toBe(0);
    expect(calculatePercentageChange(10, 0)).toBe(0);
    expect(calculatePercentageChange(15, 10)).toBe(0.5);
  });
});
