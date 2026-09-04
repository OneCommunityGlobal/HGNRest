jest.mock('../../models/costs', () => {
  const mock = jest.fn();
  mock.bulkWrite = jest.fn();
  mock.COST_CATEGORIES = [
    'Total Cost of Labor',
    'Total Cost of Materials',
    'Total Cost of Equipment',
  ];
  mock.DEFAULT_HOURLY_RATE = 25;
  return mock;
});
jest.mock('../../models/bmdashboard/buildingProject');
jest.mock('../../models/bmdashboard/buildingMaterial');
jest.mock('../../models/bmdashboard/buildingTool');
jest.mock('../../startup/logger', () => ({
  logException: jest.fn(),
}));

const Cost = require('../../models/costs');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const BuildingMaterial = require('../../models/bmdashboard/buildingMaterial');
const BuildingTool = require('../../models/bmdashboard/buildingTool');
const logger = require('../../startup/logger');

const VALID_OID_STR = '507f1f77bcf86cd799439011';
const VALID_OID_STR_2 = '507f1f77bcf86cd799439012';

function makeProject(overrides = {}) {
  return {
    _id: VALID_OID_STR,
    name: 'Test Project',
    projectType: 'commercial',
    dateCreated: new Date('2025-01-15'),
    members: [],
    ...overrides,
  };
}

describe('costAggregationService', () => {
  let runCostAggregation;
  let triggerProjectAggregation;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Re-require to get fresh module state for debounce timers
    jest.isolateModules(() => {
      const service = require('./costAggregationService');
      runCostAggregation = service.runCostAggregation;
      triggerProjectAggregation = service.triggerProjectAggregation;
    });
  });

  // ========================
  // runCostAggregation
  // ========================
  describe('runCostAggregation', () => {
    test('B.1 — returns { updated: 0, errors: [] } when no projects found', async () => {
      BuildingProject.find = jest.fn().mockResolvedValue([]);

      const result = await runCostAggregation();

      expect(BuildingProject.find).toHaveBeenCalledWith({});
      expect(result).toEqual({ updated: 0, errors: [] });
    });

    test('B.2 — uses $in filter when projectIds array provided', async () => {
      const project = makeProject({ members: [] });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 0, modifiedCount: 0 });

      await runCostAggregation([VALID_OID_STR]);

      expect(BuildingProject.find).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.objectContaining({ $in: expect.any(Array) }) }),
      );
    });

    test('B.3 — labor only: creates upsert for Total Cost of Labor', async () => {
      const project = makeProject({
        members: [{ hours: 10 }, { hours: 5 }],
      });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 });

      const result = await runCostAggregation();

      expect(Cost.bulkWrite).toHaveBeenCalled();
      const ops = Cost.bulkWrite.mock.calls[0][0];
      expect(ops.length).toBe(1);
      expect(ops[0].updateOne.filter.category).toBe('Total Cost of Labor');
      expect(ops[0].updateOne.update.$set.amount).toBe(375); // (10 + 5) * 25
      expect(result.updated).toBe(1);
    });

    test('B.4 — materials approved: creates upserts for Total Cost of Materials', async () => {
      const project = makeProject({ members: [] });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([
        {
          purchaseRecord: [
            { status: 'Approved', quantity: 10, unitPrice: 5, date: '2025-03-01' },
            { status: 'Pending', quantity: 20, unitPrice: 3, date: '2025-03-02' },
          ],
        },
      ]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 });

      const result = await runCostAggregation();

      expect(Cost.bulkWrite).toHaveBeenCalled();
      const ops = Cost.bulkWrite.mock.calls[0][0];
      const materialOps = ops.filter(
        (op) => op.updateOne.filter.category === 'Total Cost of Materials',
      );
      expect(materialOps.length).toBe(1);
      expect(materialOps[0].updateOne.update.$set.amount).toBe(50); // 10 * 5
      expect(result.updated).toBe(1);
    });

    test('B.5 — tools approved: creates upserts for Total Cost of Equipment', async () => {
      const project = makeProject({ members: [] });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([]);
      BuildingTool.find = jest.fn().mockResolvedValue([
        {
          purchaseRecord: [{ status: 'Approved', quantity: 2, unitPrice: 100, date: '2025-04-01' }],
        },
      ]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 });

      const result = await runCostAggregation();

      const ops = Cost.bulkWrite.mock.calls[0][0];
      const toolOps = ops.filter(
        (op) => op.updateOne.filter.category === 'Total Cost of Equipment',
      );
      expect(toolOps.length).toBe(1);
      expect(toolOps[0].updateOne.update.$set.amount).toBe(200); // 2 * 100
      expect(result.updated).toBe(1);
    });

    test('B.6 — per-project error: error captured in result.errors', async () => {
      const project = makeProject({
        members: [{ hours: 10 }],
      });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockRejectedValue(new Error('bulk write failed'));

      const result = await runCostAggregation();

      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toMatch(/Aggregation failed for project/);
      expect(logger.logException).toHaveBeenCalled();
    });

    test('B.7 — top-level throw: BuildingProject.find rejects', async () => {
      BuildingProject.find = jest.fn().mockRejectedValue(new Error('DB connection failed'));

      const result = await runCostAggregation();

      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toMatch(/Aggregation failed/);
      expect(logger.logException).toHaveBeenCalled();
    });

    test('B.8 — string projectIds are mapped to ObjectId', async () => {
      BuildingProject.find = jest.fn().mockResolvedValue([]);

      await runCostAggregation([VALID_OID_STR, VALID_OID_STR_2]);

      const findArg = BuildingProject.find.mock.calls[0][0];
      expect(findArg._id.$in).toBeDefined();
      expect(findArg._id.$in.length).toBe(2);
    });

    test('B.extra — project with no labor, no materials, no tools: no bulkWrite', async () => {
      const project = makeProject({ members: [] });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);

      const result = await runCostAggregation();

      expect(Cost.bulkWrite).not.toHaveBeenCalled();
      expect(result).toEqual({ updated: 0, errors: [] });
    });

    test('B.extra — all three categories combined', async () => {
      const project = makeProject({
        members: [{ hours: 8 }],
      });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([
        {
          purchaseRecord: [{ status: 'Approved', quantity: 5, unitPrice: 10, date: '2025-03-01' }],
        },
      ]);
      BuildingTool.find = jest.fn().mockResolvedValue([
        {
          purchaseRecord: [{ status: 'Approved', quantity: 1, unitPrice: 50, date: '2025-04-01' }],
        },
      ]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 3, modifiedCount: 0 });

      const result = await runCostAggregation();

      const ops = Cost.bulkWrite.mock.calls[0][0];
      expect(ops.length).toBe(3);
      const categories = ops.map((op) => op.updateOne.filter.category);
      expect(categories).toContain('Total Cost of Labor');
      expect(categories).toContain('Total Cost of Materials');
      expect(categories).toContain('Total Cost of Equipment');
      expect(result.updated).toBe(3);
    });

    test('B.extra — member with missing hours treated as 0', async () => {
      const project = makeProject({
        members: [{ hours: 10 }, {}, { hours: null }],
      });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 });

      await runCostAggregation();

      const ops = Cost.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.update.$set.amount).toBe(250); // 10 * 25
    });

    test('B.extra — purchase records with zero amount not included', async () => {
      const project = makeProject({ members: [] });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([
        {
          purchaseRecord: [
            { status: 'Approved', quantity: 0, unitPrice: 10, date: '2025-03-01' },
            { status: 'Approved', quantity: 5, unitPrice: 0, date: '2025-03-01' },
          ],
        },
      ]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);

      await runCostAggregation();

      expect(Cost.bulkWrite).not.toHaveBeenCalled();
    });

    test('B.extra — multiple projects: each processed independently', async () => {
      const project1 = makeProject({ _id: VALID_OID_STR, members: [{ hours: 4 }] });
      const project2 = makeProject({ _id: VALID_OID_STR_2, members: [{ hours: 8 }] });
      BuildingProject.find = jest.fn().mockResolvedValue([project1, project2]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 });

      const result = await runCostAggregation();

      expect(Cost.bulkWrite).toHaveBeenCalledTimes(2);
      expect(result.updated).toBe(2);
    });

    test('B.extra — project uses createdAt as fallback for labor date', async () => {
      const project = makeProject({
        members: [{ hours: 5 }],
        dateCreated: undefined,
        createdAt: new Date('2025-06-01'),
      });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 });

      await runCostAggregation();

      const ops = Cost.bulkWrite.mock.calls[0][0];
      const { costDate } = ops[0].updateOne.filter;
      expect(costDate.toISOString().split('T')[0]).toBe('2025-06-01');
    });

    test('B.extra — multiple approved records on same date are summed', async () => {
      const project = makeProject({ members: [] });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([
        {
          purchaseRecord: [
            { status: 'Approved', quantity: 2, unitPrice: 10, date: '2025-03-01' },
            { status: 'Approved', quantity: 3, unitPrice: 10, date: '2025-03-01' },
          ],
        },
      ]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 });

      await runCostAggregation();

      const ops = Cost.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.update.$set.amount).toBe(50); // (2*10) + (3*10)
    });

    test('B.extra — purchase record with no date defaults to today', async () => {
      const project = makeProject({ members: [] });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([
        {
          purchaseRecord: [{ status: 'Approved', quantity: 1, unitPrice: 25 }],
        },
      ]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 });

      await runCostAggregation();

      const ops = Cost.bulkWrite.mock.calls[0][0];
      expect(ops.length).toBe(1);
      const { costDate } = ops[0].updateOne.filter;
      const todayStr = new Date().toISOString().split('T')[0];
      expect(costDate.toISOString().split('T')[0]).toBe(todayStr);
    });

    test('B.extra — project with null members returns 0 labor', async () => {
      const project = makeProject({ members: null });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);

      await runCostAggregation();

      expect(Cost.bulkWrite).not.toHaveBeenCalled();
    });

    test('B.extra — inventory doc with no purchaseRecord is skipped', async () => {
      const project = makeProject({ members: [] });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([{ noRecord: true }]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);

      await runCostAggregation();

      expect(Cost.bulkWrite).not.toHaveBeenCalled();
    });

    test('B.extra — project without name defaults to Unnamed Project', async () => {
      const project = makeProject({ name: undefined, members: [{ hours: 2 }] });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 });

      await runCostAggregation();

      const ops = Cost.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.update.$set.projectName).toBe('Unnamed Project');
    });

    test('B.extra — project without projectType defaults to private', async () => {
      const project = makeProject({ projectType: undefined, members: [{ hours: 2 }] });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 });

      await runCostAggregation();

      const ops = Cost.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.update.$set.projectType).toBe('private');
    });

    test('B.extra — null projectIds aggregates all projects', async () => {
      BuildingProject.find = jest.fn().mockResolvedValue([]);

      await runCostAggregation(null);

      expect(BuildingProject.find).toHaveBeenCalledWith({});
    });

    test('B.extra — empty projectIds array aggregates all projects', async () => {
      BuildingProject.find = jest.fn().mockResolvedValue([]);

      await runCostAggregation([]);

      expect(BuildingProject.find).toHaveBeenCalledWith({});
    });

    test('B.extra — approved status case insensitive with whitespace', async () => {
      const project = makeProject({ members: [] });
      BuildingProject.find = jest.fn().mockResolvedValue([project]);
      BuildingMaterial.find = jest.fn().mockResolvedValue([
        {
          purchaseRecord: [
            { status: '  Approved  ', quantity: 1, unitPrice: 10, date: '2025-03-01' },
          ],
        },
      ]);
      BuildingTool.find = jest.fn().mockResolvedValue([]);
      Cost.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 });

      await runCostAggregation();

      expect(Cost.bulkWrite).toHaveBeenCalled();
      const ops = Cost.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.update.$set.amount).toBe(10);
    });
  });

  // ========================
  // triggerProjectAggregation
  // ========================
  describe('triggerProjectAggregation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('B.9 — first call does not invoke runCostAggregation immediately', () => {
      BuildingProject.find = jest.fn().mockResolvedValue([]);
      triggerProjectAggregation(VALID_OID_STR);

      expect(BuildingProject.find).not.toHaveBeenCalled();
    });

    test('B.9b — fires after debounce delay', async () => {
      BuildingProject.find = jest.fn().mockResolvedValue([]);

      triggerProjectAggregation(VALID_OID_STR);

      jest.advanceTimersByTime(30000);

      // Allow the async callback to resolve
      await Promise.resolve();
      await Promise.resolve();

      expect(BuildingProject.find).toHaveBeenCalled();
    });

    test('B.10 — second call resets timer, only one aggregation run', async () => {
      BuildingProject.find = jest.fn().mockResolvedValue([]);

      triggerProjectAggregation(VALID_OID_STR);
      jest.advanceTimersByTime(20000);

      triggerProjectAggregation(VALID_OID_STR);
      jest.advanceTimersByTime(20000);

      // First timer would have fired at 30s, but was cleared
      await Promise.resolve();
      await Promise.resolve();

      expect(BuildingProject.find).not.toHaveBeenCalled();

      jest.advanceTimersByTime(10000); // total 30s from second call
      await Promise.resolve();
      await Promise.resolve();

      expect(BuildingProject.find).toHaveBeenCalledTimes(1);
    });

    test('B.extra — error in aggregation is logged', async () => {
      BuildingProject.find = jest.fn().mockRejectedValue(new Error('trigger error'));

      triggerProjectAggregation(VALID_OID_STR);
      jest.advanceTimersByTime(30000);

      // Allow the async callback and its catch to resolve
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(logger.logException).toHaveBeenCalled();
    });
  });
});
