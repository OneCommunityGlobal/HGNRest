jest.mock('../../../models/bmdashboard/buildingExpenditure', () => ({
  find: jest.fn(),
  aggregate: jest.fn(),
  distinct: jest.fn(),
}));

const Expenditures = require('../../../models/bmdashboard/buildingExpenditure');
const bmExpenditureController = require('../bmExpenditureController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

const makeQuery = (resolvedValue) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolvedValue),
});

describe('bmExpenditureController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllExpenditure', () => {
    it('returns 200 with transformed expenditure data on success', async () => {
      const rawExpenditures = [
        {
          _id: 'someInternalId1',
          projectId: 'proj1',
          date: '2024-01-10',
          category: 'Labor',
          cost: 1000,
        },
        {
          _id: 'someInternalId2',
          projectId: 'proj2',
          date: '2024-02-15',
          category: 'Materials',
          cost: 500,
        },
      ];
      const query = makeQuery(rawExpenditures);
      Expenditures.find.mockReturnValue(query);

      const req = {};
      const res = makeRes();

      await bmExpenditureController.getAllExpenditure(req, res);

      expect(Expenditures.find).toHaveBeenCalledTimes(1);
      expect(query.select).toHaveBeenCalledWith('projectId date category cost');
      expect(query.lean).toHaveBeenCalledTimes(1);
      expect(query.exec).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          { projectId: 'proj1', date: '2024-01-10', category: 'Labor', cost: 1000 },
          { projectId: 'proj2', date: '2024-02-15', category: 'Materials', cost: 500 },
        ],
      });
    });

    it('strips out fields other than projectId, date, category, and cost', async () => {
      const rawExpenditures = [
        {
          _id: 'someInternalId1',
          __v: 0,
          projectId: 'proj1',
          date: '2024-01-10',
          category: 'Labor',
          cost: 1000,
          extraField: 'should not appear',
        },
      ];
      const query = makeQuery(rawExpenditures);
      Expenditures.find.mockReturnValue(query);

      const res = makeRes();
      await bmExpenditureController.getAllExpenditure({}, res);

      const [[payload]] = res.json.mock.calls;
      expect(payload.data[0]).toEqual({
        projectId: 'proj1',
        date: '2024-01-10',
        category: 'Labor',
        cost: 1000,
      });
      expect(payload.data[0]).not.toHaveProperty('_id');
      expect(payload.data[0]).not.toHaveProperty('__v');
      expect(payload.data[0]).not.toHaveProperty('extraField');
    });

    it('returns 200 with an empty data array when no expenditures exist', async () => {
      const query = makeQuery([]);
      Expenditures.find.mockReturnValue(query);

      const res = makeRes();
      await bmExpenditureController.getAllExpenditure({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('returns 500 with the error message when the query rejects', async () => {
      const error = new Error('DB connection lost');
      const query = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(error),
      };
      Expenditures.find.mockReturnValue(query);

      const res = makeRes();
      await bmExpenditureController.getAllExpenditure({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server error DB connection lost',
      });
    });
  });

  describe('getProjectIdsWithExpenditure', () => {
    it('returns 200 with the distinct project ids', async () => {
      Expenditures.distinct.mockResolvedValue(['proj1', 'proj2']);
      const res = makeRes();

      await bmExpenditureController.getProjectIdsWithExpenditure({}, res);

      expect(Expenditures.distinct).toHaveBeenCalledWith('projectId');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: ['proj1', 'proj2'] });
    });

    it('returns 500 when the query rejects', async () => {
      Expenditures.distinct.mockRejectedValue(new Error('DB down'));
      const res = makeRes();

      await bmExpenditureController.getProjectIdsWithExpenditure({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server error DB down',
      });
    });
  });

  describe('getCostBreakdown', () => {
    it('returns 400 when projectId is missing', async () => {
      const req = { params: {}, query: {} };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'projectId is required',
      });
      expect(Expenditures.aggregate).not.toHaveBeenCalled();
    });

    it('returns 400 when projectId is an object instead of a string (NoSQL injection attempt)', async () => {
      // aggregate() sends $match straight to MongoDB with no Mongoose schema casting, so an
      // object like { $ne: null } for the id param would inject a query operator if it ever
      // reached the pipeline unchecked.
      const req = { params: { id: { $ne: null } }, query: {} };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'projectId is required',
      });
      expect(Expenditures.aggregate).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid startDate', async () => {
      const req = { params: { id: 'proj1' }, query: { startDate: 'not-a-date' } };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid startDate' });
      expect(Expenditures.aggregate).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid endDate', async () => {
      const req = { params: { id: 'proj1' }, query: { endDate: 'not-a-date' } };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid endDate' });
      expect(Expenditures.aggregate).not.toHaveBeenCalled();
    });

    it('aggregates with only a projectId match when no date range is given', async () => {
      Expenditures.aggregate.mockResolvedValue([]);
      const req = { params: { id: 'proj1' }, query: {} };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      const [pipeline] = Expenditures.aggregate.mock.calls[0];
      expect(pipeline[0]).toEqual({ $match: { projectId: 'proj1' } });
      expect(pipeline[2]).toEqual({ $match: { normalizedDate: { $ne: null } } });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ actual: [] });
    });

    it('aggregates across every project when id is "all"', async () => {
      Expenditures.aggregate.mockResolvedValue([]);
      const req = { params: { id: 'all' }, query: {} };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      const [pipeline] = Expenditures.aggregate.mock.calls[0];
      expect(pipeline[0]).toEqual({ $match: {} });
      expect(pipeline[2]).toEqual({ $match: { normalizedDate: { $ne: null } } });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('still applies a date range when id is "all"', async () => {
      Expenditures.aggregate.mockResolvedValue([]);
      const req = {
        params: { id: 'all' },
        query: { startDate: '2024-01-01', endDate: '2024-03-31' },
      };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      const [pipeline] = Expenditures.aggregate.mock.calls[0];
      expect(pipeline[0]).toEqual({ $match: {} });
      expect(pipeline[2].$match.normalizedDate).toEqual({
        $ne: null,
        $gte: new Date('2024-01-01'),
        $lte: new Date('2024-03-31'),
      });
    });

    it('includes a date range in the normalizedDate match stage when startDate/endDate are provided', async () => {
      Expenditures.aggregate.mockResolvedValue([]);
      const req = {
        params: { id: 'proj1' },
        query: { startDate: '2024-01-01', endDate: '2024-03-31' },
      };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      const [pipeline] = Expenditures.aggregate.mock.calls[0];
      expect(pipeline[0]).toEqual({ $match: { projectId: 'proj1' } });
      expect(pipeline[2].$match.normalizedDate).toEqual({
        $ne: null,
        $gte: new Date('2024-01-01'),
        $lte: new Date('2024-03-31'),
      });
    });

    it('excludes rows whose date could not be coerced from the aggregation', async () => {
      Expenditures.aggregate.mockResolvedValue([]);
      const req = { params: { id: 'proj1' }, query: {} };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      const [pipeline] = Expenditures.aggregate.mock.calls[0];
      expect(pipeline[1]).toEqual({
        $addFields: {
          normalizedDate: {
            $convert: { input: '$date', to: 'date', onError: null, onNull: null },
          },
        },
      });
      expect(pipeline[2]).toEqual({ $match: { normalizedDate: { $ne: null } } });
    });

    it('groups aggregated rows by month and pivots categories into columns', async () => {
      Expenditures.aggregate.mockResolvedValue([
        { _id: { year: 2024, month: 1, category: 'Plumbing' }, totalCost: 5000 },
        { _id: { year: 2024, month: 1, category: 'Electrical' }, totalCost: 4500 },
        { _id: { year: 2024, month: 1, category: 'Structural' }, totalCost: 7000 },
        { _id: { year: 2024, month: 1, category: 'Mechanical' }, totalCost: 6000 },
        { _id: { year: 2024, month: 2, category: 'Plumbing' }, totalCost: 4000 },
      ]);
      const req = { params: { id: 'proj1' }, query: {} };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        actual: [
          {
            month: 'Jan 2024',
            plumbing: 5000,
            electrical: 4500,
            structural: 7000,
            mechanical: 6000,
          },
          { month: 'Feb 2024', plumbing: 4000, electrical: 0, structural: 0, mechanical: 0 },
        ],
      });
    });

    it('ignores categories outside the known cost-breakdown set', async () => {
      Expenditures.aggregate.mockResolvedValue([
        { _id: { year: 2024, month: 1, category: 'Labor' }, totalCost: 999 },
      ]);
      const req = { params: { id: 'proj1' }, query: {} };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      expect(res.json).toHaveBeenCalledWith({
        actual: [{ month: 'Jan 2024', plumbing: 0, electrical: 0, structural: 0, mechanical: 0 }],
      });
    });

    it('returns 500 when the aggregation rejects', async () => {
      const error = new Error('aggregation failed');
      Expenditures.aggregate.mockRejectedValue(error);
      const req = { params: { id: 'proj1' }, query: {} };
      const res = makeRes();

      await bmExpenditureController.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server error aggregation failed',
      });
    });
  });
});
