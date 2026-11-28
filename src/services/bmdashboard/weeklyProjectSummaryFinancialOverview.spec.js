const VALID_PROJECT_ID = '507f1f77bcf86cd799439011';
const CURRENT_START = '2026-08-30';
const CURRENT_END = '2026-09-05';
const COMPARISON_START = '2026-08-23';
const COMPARISON_END = '2026-08-29';
const COST_METRICS = [
  'totalProjectCost',
  'totalMaterialCost',
  'totalLaborCost',
  'totalEquipmentCost',
];

jest.mock('../../models/bmdashboard/buildingMaterial', () => ({ aggregate: jest.fn() }));
jest.mock('../../models/bmdashboard/buildingTool', () => ({ aggregate: jest.fn() }));
jest.mock('../../models/bmdashboard/buildingProject', () => ({ findById: jest.fn() }));
jest.mock('../../models/laborCost', () => ({ aggregate: jest.fn() }));
jest.mock('../../models/projectStatus', () => ({ aggregate: jest.fn() }));
jest.mock('../../models/bmdashboard/projectRiskProfile', () => ({ find: jest.fn() }));
jest.mock('../../models/bmdashboard/Issues', () => ({ find: jest.fn() }));

const BuildingMaterial = require('../../models/bmdashboard/buildingMaterial');
const BuildingTool = require('../../models/bmdashboard/buildingTool');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const LaborCost = require('../../models/laborCost');
const ProjectRiskProfile = require('../../models/bmdashboard/projectRiskProfile');
const Issue = require('../../models/bmdashboard/Issues');
const {
  COMPARISON_TYPES,
  getWeeklyProjectSummaryFinancialOverview,
  testExports: { sumKnownCosts },
} = require('./weeklyProjectSummaryService');

// One call per model for each period: materials and tools use approved purchases, labor uses LaborCost.
function mockCosts({
  materialRows = [{ cost: 100 }],
  laborRows = [{ totalLaborCost: 75 }],
  toolRows = [{ cost: 30 }],
} = {}) {
  BuildingMaterial.aggregate.mockResolvedValueOnce(materialRows);
  LaborCost.aggregate.mockResolvedValueOnce(laborRows);
  BuildingTool.aggregate.mockResolvedValueOnce(toolRows);
}

// Mongoose find().select().lean() chain
const findResult = (rows) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(rows) }),
});

function mockProject(project = { _id: VALID_PROJECT_ID, name: 'Building 1' }) {
  BuildingProject.findById.mockReturnValue(findResult(project));
}

// Halfway through a 60-day project on "today" (2026-09-03): $60k spent of a $100k estimate.
const HALFWAY_PROFILE = {
  startDate: new Date('2026-08-04T12:00:00.000Z'),
  endDate: new Date('2026-10-03T12:00:00.000Z'),
  initialCostEstimate: 100000,
  currentCostIncurred: 60000,
};

describe('getWeeklyProjectSummaryFinancialOverview', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    jest.clearAllMocks();
    ProjectRiskProfile.find.mockReturnValue(findResult([]));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns the six overview cards from real cost data', async () => {
    mockCosts();

    const result = await getWeeklyProjectSummaryFinancialOverview({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });
    const { metrics } = result.current;

    expect(result.projectId).toBe('all');
    expect(result.comparison).toBeNull();
    expect(Object.keys(metrics)).toEqual([
      'totalProjectedCost',
      'predictedCostOverrun',
      ...COST_METRICS,
    ]);
    expect(metrics.totalMaterialCost).toMatchObject({ value: 100, unit: 'USD' });
    expect(metrics.totalLaborCost.value).toBe(75);
    expect(metrics.totalEquipmentCost.value).toBe(30);
    expect(metrics.totalProjectCost).toMatchObject({
      value: 205,
      comparisonType: COMPARISON_TYPES.PERIOD_COMPARABLE,
    });
  });

  test('projects the final cost from the share of time passed and compares it to the estimate', async () => {
    mockCosts();
    ProjectRiskProfile.find.mockReturnValue(
      findResult([
        HALFWAY_PROFILE,
        { ...HALFWAY_PROFILE, currentCostIncurred: null },
        { ...HALFWAY_PROFILE, initialCostEstimate: 0 },
      ]),
    );

    const { metrics } = (
      await getWeeklyProjectSummaryFinancialOverview({
        startDate: CURRENT_START,
        endDate: CURRENT_END,
      })
    ).current;

    // $60k at the halfway point projects to $120k, which is $20k over the $100k estimate.
    expect(metrics.totalProjectedCost).toMatchObject({
      value: 120000,
      unit: 'USD',
      comparisonType: COMPARISON_TYPES.CURRENT_ONLY,
      percentageChange: null,
    });
    expect(metrics.predictedCostOverrun.value).toBe(20000);
    expect(ProjectRiskProfile.find).toHaveBeenCalledWith({
      startDate: { $lte: expect.any(Date) },
      endDate: { $gte: expect.any(Date) },
    });
  });

  test('uses the cost incurred as the projection once the project end date has passed', async () => {
    mockCosts();
    ProjectRiskProfile.find.mockReturnValue(
      findResult([{ ...HALFWAY_PROFILE, endDate: new Date('2026-09-01T12:00:00.000Z') }]),
    );

    const { metrics } = (
      await getWeeklyProjectSummaryFinancialOverview({
        startDate: CURRENT_START,
        endDate: CURRENT_END,
      })
    ).current;

    expect(metrics.totalProjectedCost.value).toBe(60000);
    expect(metrics.predictedCostOverrun.value).toBe(-40000);
  });

  test('shows projections as unavailable when no risk profile runs through the dates', async () => {
    mockCosts();

    const { metrics } = (
      await getWeeklyProjectSummaryFinancialOverview({
        startDate: CURRENT_START,
        endDate: CURRENT_END,
      })
    ).current;

    ['totalProjectedCost', 'predictedCostOverrun'].forEach((metricName) => {
      expect(metrics[metricName]).toMatchObject({
        value: null,
        comparisonType: COMPARISON_TYPES.UNAVAILABLE,
        percentageChange: null,
      });
      expect(metrics[metricName].unavailableReason).toMatch(/cost estimate/);
    });
  });

  test('shows the latest projection for past dates too, without a comparison', async () => {
    mockCosts();
    mockCosts();
    ProjectRiskProfile.find.mockReturnValue(findResult([HALFWAY_PROFILE]));

    const { metrics } = (
      await getWeeklyProjectSummaryFinancialOverview({
        startDate: COMPARISON_START,
        endDate: COMPARISON_END,
        comparisonStartDate: '2026-08-16',
        comparisonEndDate: '2026-08-22',
      })
    ).current;

    expect(metrics.totalProjectedCost).toMatchObject({
      value: 120000,
      comparisonType: COMPARISON_TYPES.CURRENT_ONLY,
      percentageChange: null,
    });
    expect(metrics.totalProjectedCost.unavailableReason).toMatch(/no earlier projection/);
  });

  test('adds the week over week change for each cost card', async () => {
    mockCosts();
    mockCosts({
      materialRows: [{ cost: 50 }],
      laborRows: [{ totalLaborCost: 25 }],
      toolRows: [{ cost: 30 }],
    });

    const result = await getWeeklyProjectSummaryFinancialOverview({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
      comparisonStartDate: COMPARISON_START,
      comparisonEndDate: COMPARISON_END,
    });
    const { metrics } = result.current;

    expect(result.comparison).toMatchObject({
      startDate: COMPARISON_START,
      endDate: COMPARISON_END,
    });
    expect(metrics.totalMaterialCost).toMatchObject({ comparisonValue: 50, percentageChange: 1 });
    expect(metrics.totalLaborCost.percentageChange).toBe(2);
    expect(metrics.totalEquipmentCost.percentageChange).toBe(0);
    expect(metrics.totalProjectCost).toMatchObject({
      comparisonValue: 105,
      percentageChange: 0.95,
    });
    expect(metrics.totalProjectedCost.percentageChange).toBeNull();
  });

  test('marks a cost unavailable when the period has no records, and totals only known costs', async () => {
    mockCosts({ toolRows: [] });

    const { metrics } = (
      await getWeeklyProjectSummaryFinancialOverview({
        startDate: CURRENT_START,
        endDate: CURRENT_END,
      })
    ).current;

    expect(metrics.totalEquipmentCost).toMatchObject({
      value: null,
      comparisonType: COMPARISON_TYPES.UNAVAILABLE,
    });
    expect(metrics.totalProjectCost.value).toBe(175);
  });

  test('marks the total unavailable when no cost records exist at all', async () => {
    mockCosts({ materialRows: [], laborRows: [], toolRows: [] });

    const { metrics } = (
      await getWeeklyProjectSummaryFinancialOverview({
        startDate: CURRENT_START,
        endDate: CURRENT_END,
      })
    ).current;

    COST_METRICS.forEach((metricName) => {
      expect(metrics[metricName]).toMatchObject({
        value: null,
        comparisonType: COMPARISON_TYPES.UNAVAILABLE,
      });
    });
  });

  test('filters every cost by the selected project', async () => {
    mockProject();
    mockCosts();
    Issue.find.mockReturnValue(findResult([{ _id: 'issue-1' }, { _id: 'issue-2' }]));

    const result = await getWeeklyProjectSummaryFinancialOverview({
      projectId: VALID_PROJECT_ID,
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });

    expect(result.projectId).toBe(VALID_PROJECT_ID);
    [BuildingMaterial, BuildingTool].forEach((Model) => {
      const [pipeline] = Model.aggregate.mock.calls[0];
      expect(pipeline[0]).toEqual({ $match: { project: VALID_PROJECT_ID } });
      expect(pipeline[2].$match['purchaseRecord.status']).toBe('Approved');
    });
    const [laborPipeline] = LaborCost.aggregate.mock.calls[0];
    expect(laborPipeline[0].$match.project_name).toBe('Building 1');
    // Risk profiles reach the BM project through their Issue record.
    expect(Issue.find).toHaveBeenCalledWith({ projectId: VALID_PROJECT_ID });
    expect(ProjectRiskProfile.find.mock.calls[0][0].projectId).toEqual({
      $in: ['issue-1', 'issue-2'],
    });
  });

  test('throws a 404 error when the selected project does not exist', async () => {
    mockProject(null);

    await expect(
      getWeeklyProjectSummaryFinancialOverview({
        projectId: VALID_PROJECT_ID,
        startDate: CURRENT_START,
        endDate: CURRENT_END,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('sumKnownCosts', () => {
  test.each([
    [[100, 75.555, 30], 205.56],
    [[100, null, 0], 100],
    [[null, null, null], null],
  ])('adds %j to %s', (costs, expected) => {
    expect(sumKnownCosts(costs)).toBe(expected);
  });
});
