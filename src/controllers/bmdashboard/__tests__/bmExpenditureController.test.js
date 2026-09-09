jest.mock('../../../models/bmdashboard/buildingExpenditure', () => ({
  find: jest.fn(),
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
});
