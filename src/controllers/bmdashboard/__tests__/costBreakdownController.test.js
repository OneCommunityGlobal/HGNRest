const costBreakdownControllerFactory = require('../costBreakdownController');

const VALID_PROJECT_ID = '42';

const buildCostsBreakdownDoc = (costs) => ({
  projectId: VALID_PROJECT_ID,
  costs,
});

const makeCostBreakdownModel = () => {
  const CostBreakdown = jest.fn().mockImplementation(function ctor(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
  CostBreakdown.findOne = jest.fn();
  CostBreakdown.find = jest.fn();
  CostBreakdown.findOneAndDelete = jest.fn();
  return CostBreakdown;
};

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

describe('costBreakdownController', () => {
  let CostBreakdown;
  let controller;

  beforeEach(() => {
    CostBreakdown = makeCostBreakdownModel();
    controller = costBreakdownControllerFactory(CostBreakdown);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  describe('getCostBreakdown', () => {
    it('returns 400 for a non-numeric project ID without querying the DB', async () => {
      const req = { params: { projectId: 'abc' }, query: {} };
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid project ID' });
      expect(CostBreakdown.findOne).not.toHaveBeenCalled();
    });

    it('returns 404 when no cost breakdown exists for the project', async () => {
      CostBreakdown.findOne.mockResolvedValue(null);
      const req = { params: { projectId: VALID_PROJECT_ID }, query: {} };
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cost breakdown not found for this project',
        projectId: 42,
      });
    });

    it('returns 200 with all costs mapped and missing categories defaulted to 0', async () => {
      CostBreakdown.findOne.mockResolvedValue(
        buildCostsBreakdownDoc([{ month: 'Jan 2026', plumbing: 100 }]),
      );
      const req = { params: { projectId: VALID_PROJECT_ID }, query: {} };
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        projectId: 42,
        actual: [{ month: 'Jan 2026', plumbing: 100, electrical: 0, structural: 0, mechanical: 0 }],
      });
    });

    it('filters to the inclusive month range when both fromDate and toDate are given', async () => {
      CostBreakdown.findOne.mockResolvedValue(
        buildCostsBreakdownDoc([
          { month: 'Jan 2026', plumbing: 1 },
          { month: 'Feb 2026', plumbing: 2 },
          { month: 'Mar 2026', plumbing: 3 },
        ]),
      );
      const req = {
        params: { projectId: VALID_PROJECT_ID },
        query: { fromDate: '2026-02-01', toDate: '2026-02-28' },
      };
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      const { actual } = res.json.mock.calls[0][0];
      expect(actual.map((c) => c.month)).toEqual(['Feb 2026']);
    });

    it('filters to months on or after fromDate when only fromDate is given', async () => {
      CostBreakdown.findOne.mockResolvedValue(
        buildCostsBreakdownDoc([
          { month: 'Jan 2026', plumbing: 1 },
          { month: 'Feb 2026', plumbing: 2 },
          { month: 'Mar 2026', plumbing: 3 },
        ]),
      );
      const req = {
        params: { projectId: VALID_PROJECT_ID },
        query: { fromDate: '2026-02-01' },
      };
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      const { actual } = res.json.mock.calls[0][0];
      expect(actual.map((c) => c.month)).toEqual(['Feb 2026', 'Mar 2026']);
    });

    it('filters to months on or before toDate when only toDate is given', async () => {
      CostBreakdown.findOne.mockResolvedValue(
        buildCostsBreakdownDoc([
          { month: 'Jan 2026', plumbing: 1 },
          { month: 'Feb 2026', plumbing: 2 },
          { month: 'Mar 2026', plumbing: 3 },
        ]),
      );
      const req = {
        params: { projectId: VALID_PROJECT_ID },
        query: { toDate: '2026-02-28' },
      };
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      const { actual } = res.json.mock.calls[0][0];
      expect(actual.map((c) => c.month)).toEqual(['Jan 2026', 'Feb 2026']);
    });

    it('returns 500 with the error message on a DB failure', async () => {
      const error = new Error('DB down');
      CostBreakdown.findOne.mockRejectedValue(error);
      const req = { params: { projectId: VALID_PROJECT_ID }, query: {} };
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Error fetching cost breakdown. Please try again.',
        error: 'DB down',
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe('createCostBreakdown', () => {
    it('returns 400 when projectId is missing', async () => {
      const req = { body: { costs: [] } };
      const res = makeRes();

      await controller.createCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Project ID and costs array are required',
      });
    });

    it('returns 400 when costs is not an array', async () => {
      const req = { body: { projectId: 42, costs: 'not-an-array' } };
      const res = makeRes();

      await controller.createCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(CostBreakdown.findOne).not.toHaveBeenCalled();
    });

    it('returns 409 when a cost breakdown already exists for the project', async () => {
      CostBreakdown.findOne.mockResolvedValue(buildCostsBreakdownDoc([]));
      const req = { body: { projectId: 42, costs: [] } };
      const res = makeRes();

      await controller.createCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cost breakdown already exists for this project',
      });
    });

    it('creates and returns 201 with the saved cost breakdown', async () => {
      CostBreakdown.findOne.mockResolvedValue(null);
      const costs = [{ month: 'Jan 2026', plumbing: 100 }];
      const req = { body: { projectId: 42, costs } };
      const res = makeRes();

      await controller.createCostBreakdown(req, res);

      expect(CostBreakdown).toHaveBeenCalledWith({ projectId: 42, costs });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ projectId: 42, costs }));
    });

    it('returns 400 with the error message when save fails', async () => {
      CostBreakdown.findOne.mockRejectedValue(new Error('validation failed'));
      const req = { body: { projectId: 42, costs: [] } };
      const res = makeRes();

      await controller.createCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'validation failed' });
    });
  });

  // ---------------------------------------------------------------------------
  describe('addCostEntry', () => {
    it('returns 404 when the cost breakdown does not exist', async () => {
      CostBreakdown.findOne.mockResolvedValue(null);
      const req = { params: { projectId: VALID_PROJECT_ID }, body: { month: 'Jan 2026' } };
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cost breakdown not found for this project',
      });
    });

    it('pushes the new entry with defaulted categories and returns 200 with the saved doc', async () => {
      const costsArray = [];
      costsArray.push = jest.fn((entry) => Array.prototype.push.call(costsArray, entry));
      const existing = { costs: costsArray, save: jest.fn() };
      existing.save.mockResolvedValue(existing);
      CostBreakdown.findOne.mockResolvedValue(existing);

      const req = {
        params: { projectId: VALID_PROJECT_ID },
        body: { month: 'Jan 2026', plumbing: 100 },
      };
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(costsArray.push).toHaveBeenCalledWith({
        month: 'Jan 2026',
        plumbing: 100,
        electrical: 0,
        structural: 0,
        mechanical: 0,
      });
      expect(existing.save).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(existing);
    });

    it('returns 400 with the error message when save fails', async () => {
      const existing = { costs: [], save: jest.fn().mockRejectedValue(new Error('save failed')) };
      CostBreakdown.findOne.mockResolvedValue(existing);
      const req = { params: { projectId: VALID_PROJECT_ID }, body: { month: 'Jan 2026' } };
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'save failed' });
    });
  });

  // ---------------------------------------------------------------------------
  describe('updateCostEntry', () => {
    it('returns 404 when the cost breakdown does not exist', async () => {
      CostBreakdown.findOne.mockResolvedValue(null);
      const req = { params: { projectId: VALID_PROJECT_ID, costId: 'c1' }, body: {} };
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cost breakdown not found for this project',
      });
    });

    it('returns 404 when the cost entry is not found within the breakdown', async () => {
      const existing = { costs: { id: jest.fn().mockReturnValue(null) } };
      CostBreakdown.findOne.mockResolvedValue(existing);
      const req = { params: { projectId: VALID_PROJECT_ID, costId: 'missing' }, body: {} };
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(existing.costs.id).toHaveBeenCalledWith('missing');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Cost entry not found' });
    });

    it('only overwrites fields explicitly provided in the request body', async () => {
      const costEntry = {
        month: 'Jan 2026',
        plumbing: 100,
        electrical: 50,
        structural: 10,
        mechanical: 5,
      };
      const existing = {
        costs: { id: jest.fn().mockReturnValue(costEntry) },
        save: jest.fn(),
      };
      existing.save.mockResolvedValue(existing);
      CostBreakdown.findOne.mockResolvedValue(existing);

      const req = {
        params: { projectId: VALID_PROJECT_ID, costId: 'c1' },
        body: { plumbing: 999 },
      };
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(costEntry).toEqual({
        month: 'Jan 2026',
        plumbing: 999,
        electrical: 50,
        structural: 10,
        mechanical: 5,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(existing);
    });

    it('returns 400 with the error message when save fails', async () => {
      const existing = {
        costs: { id: jest.fn().mockReturnValue({}) },
        save: jest.fn().mockRejectedValue(new Error('update failed')),
      };
      CostBreakdown.findOne.mockResolvedValue(existing);
      const req = { params: { projectId: VALID_PROJECT_ID, costId: 'c1' }, body: {} };
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'update failed' });
    });
  });

  // ---------------------------------------------------------------------------
  describe('getAllCostBreakdowns', () => {
    it('returns 200 with all cost breakdowns', async () => {
      const all = [buildCostsBreakdownDoc([]), buildCostsBreakdownDoc([])];
      CostBreakdown.find.mockResolvedValue(all);
      const req = {};
      const res = makeRes();

      await controller.getAllCostBreakdowns(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(all);
    });

    it('returns 500 with the error message on a DB failure', async () => {
      CostBreakdown.find.mockRejectedValue(new Error('DB down'));
      const req = {};
      const res = makeRes();

      await controller.getAllCostBreakdowns(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'DB down' });
    });
  });

  // ---------------------------------------------------------------------------
  describe('deleteCostBreakdown', () => {
    it('returns 404 when there is nothing to delete', async () => {
      CostBreakdown.findOneAndDelete.mockResolvedValue(null);
      const req = { params: { projectId: VALID_PROJECT_ID } };
      const res = makeRes();

      await controller.deleteCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cost breakdown not found for this project',
      });
    });

    it('returns 200 on successful deletion', async () => {
      CostBreakdown.findOneAndDelete.mockResolvedValue(buildCostsBreakdownDoc([]));
      const req = { params: { projectId: VALID_PROJECT_ID } };
      const res = makeRes();

      await controller.deleteCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cost breakdown deleted successfully',
      });
    });

    it('returns 500 with the error message on a DB failure', async () => {
      CostBreakdown.findOneAndDelete.mockRejectedValue(new Error('DB down'));
      const req = { params: { projectId: VALID_PROJECT_ID } };
      const res = makeRes();

      await controller.deleteCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'DB down' });
    });
  });
});
