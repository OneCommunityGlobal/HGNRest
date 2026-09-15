const VALID_PROJECT_ID = '507f1f77bcf86cd799439011';
const CURRENT_START = '2026-08-30';
const CURRENT_END = '2026-09-05';
const COMPARISON_START = '2026-08-23';
const COMPARISON_END = '2026-08-29';

jest.mock('../../models/bmdashboard/buildingMaterial', () => ({
  aggregate: jest.fn(),
}));
jest.mock('../../models/bmdashboard/buildingProject', () => ({
  findById: jest.fn(),
}));
jest.mock('../../models/laborCost', () => ({
  aggregate: jest.fn(),
}));
jest.mock('../../models/projectStatus', () => ({
  aggregate: jest.fn(),
}));

const BuildingMaterial = require('../../models/bmdashboard/buildingMaterial');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const LaborCost = require('../../models/laborCost');
const ProjectStatus = require('../../models/projectStatus');
const {
  COMPARISON_TYPES,
  calculatePercentageChange,
  getWeeklyProjectSummaryProjectStatus,
} = require('./weeklyProjectSummaryService');

function mockProject(project = { _id: VALID_PROJECT_ID, name: 'One Community' }) {
  BuildingProject.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(project),
    }),
  });
}

function mockAggregates({
  statusRows = [
    { _id: 'Active', count: 4 },
    { _id: 'Completed', count: 2 },
    { _id: 'Delayed', count: 1 },
  ],
  completedRows = [{ completedProjects: 2, avgDurationMs: 36 * 60 * 60 * 1000 }],
  usageRows = [{ totalMaterialUsed: 20, materialWasted: 5 }],
  purchaseRows = [{ totalMaterialCost: 100 }],
  availableRows = [{ materialAvailable: 50 }],
  laborRows = [{ totalLaborCost: 75 }],
} = {}) {
  ProjectStatus.aggregate.mockResolvedValueOnce(statusRows).mockResolvedValueOnce(completedRows);
  BuildingMaterial.aggregate
    .mockResolvedValueOnce(usageRows)
    .mockResolvedValueOnce(purchaseRows)
    .mockResolvedValueOnce(availableRows);
  LaborCost.aggregate.mockResolvedValueOnce(laborRows);
}

describe('weeklyProjectSummaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      comparisonType: COMPARISON_TYPES.CURRENT_ONLY,
      percentageChange: null,
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
      value: null,
      comparisonType: COMPARISON_TYPES.UNAVAILABLE,
    });
    expect(JSON.stringify(result)).not.toContain('426');
    expect(JSON.stringify(result)).not.toContain('27.6');
    expect(JSON.stringify(result)).not.toContain('18.4');
  });

  test('returns current and comparison metrics with percentage changes only for period-comparable metrics', async () => {
    mockAggregates();
    mockAggregates({
      statusRows: [{ _id: 'Active', count: 2 }],
      completedRows: [{ completedProjects: 1, avgDurationMs: 18 * 60 * 60 * 1000 }],
      usageRows: [{ totalMaterialUsed: 10, materialWasted: 10 }],
      purchaseRows: [{ totalMaterialCost: 50 }],
      availableRows: [{ materialAvailable: 45 }],
      laborRows: [{ totalLaborCost: 25 }],
    });

    const result = await getWeeklyProjectSummaryProjectStatus({
      startDate: CURRENT_START,
      endDate: CURRENT_END,
      comparisonStartDate: COMPARISON_START,
      comparisonEndDate: COMPARISON_END,
    });

    expect(result.comparison.startDate).toBe(COMPARISON_START);
    expect(result.current.metrics.completedProjects.percentageChange).toBe(1);
    expect(result.current.metrics.totalMaterialUsed.percentageChange).toBe(1);
    expect(result.current.metrics.totalMaterialCost.percentageChange).toBe(1);
    expect(result.current.metrics.materialWasted.percentageChange).toBe(-0.5);
    expect(result.current.metrics.totalLaborCost.percentageChange).toBe(2);
    expect(result.current.metrics.totalProjects.percentageChange).toBeNull();
    expect(result.current.metrics.activeProjects.percentageChange).toBeNull();
    expect(result.current.metrics.delayedProjects.percentageChange).toBeNull();
    expect(result.current.metrics.materialAvailable.percentageChange).toBeNull();
    expect(result.current.metrics.totalLaborHoursInvested.percentageChange).toBeNull();
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
    expect(ProjectStatus.aggregate.mock.calls[1][0][0].$match.name).toBe('One Community');
    expect(BuildingMaterial.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { project: VALID_PROJECT_ID },
    });
    expect(LaborCost.aggregate.mock.calls[0][0][0].$match.project_name).toBe('One Community');
  });

  test('all-project filtering does not restrict models by project', async () => {
    mockAggregates();

    await getWeeklyProjectSummaryProjectStatus({
      projectId: 'all',
      startDate: CURRENT_START,
      endDate: CURRENT_END,
    });

    expect(BuildingProject.findById).not.toHaveBeenCalled();
    expect(ProjectStatus.aggregate.mock.calls[0][0][0]).toEqual({
      $group: { _id: '$status', count: { $sum: 1 } },
    });
    expect(BuildingMaterial.aggregate.mock.calls[0][0][0]).toEqual({ $match: {} });
    expect(LaborCost.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { date: expect.objectContaining({ $gte: expect.any(Date), $lte: expect.any(Date) }) },
    });
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

  test('handles previous zero according to HGN comparison convention', () => {
    expect(calculatePercentageChange(0, 0)).toBe(0);
    expect(calculatePercentageChange(10, 0)).toBe('No Comparison Data');
    expect(calculatePercentageChange(15, 10)).toBe(0.5);
  });
});
