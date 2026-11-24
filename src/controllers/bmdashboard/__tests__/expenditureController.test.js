jest.mock('../../../models/bmdashboard/expenditure', () => ({
  distinct: jest.fn(),
  aggregate: jest.fn(),
}));

jest.mock('../../../models/bmdashboard/projectBudget', () => ({
  distinct: jest.fn(),
}));

jest.mock('../../../utilities/projectBudgetHelper', () => ({
  ...jest.requireActual('../../../utilities/projectBudgetHelper'),
  getProjectBudget: jest.fn(),
}));

jest.mock('../../../startup/logger', () => ({
  logException: jest.fn(),
  logInfo: jest.fn(),
}));

const Expenditure = require('../../../models/bmdashboard/expenditure');
const ProjectBudget = require('../../../models/bmdashboard/projectBudget');
const { getProjectBudget } = require('../../../utilities/projectBudgetHelper');
const logger = require('../../../startup/logger');
const { getProjectExpensesPie, getProjectIdsWithExpenditure } = require('../expenditureController');

const VALID_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439012';
const INVALID_ID = 'not-a-valid-id';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

describe('expenditureController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ProjectBudget.distinct.mockResolvedValue([]);
    getProjectBudget.mockResolvedValue(null);
  });

  // ---------------------------------------------------------------------------
  describe('getProjectIdsWithExpenditure', () => {
    it('returns 200 with the array of project IDs on success', async () => {
      const ids = [VALID_ID, OTHER_ID];
      Expenditure.distinct.mockResolvedValue(ids);

      const res = makeRes();
      await getProjectIdsWithExpenditure({}, res);

      expect(Expenditure.distinct).toHaveBeenCalledWith('projectId');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(ids);
    });

    it('includes projects that only have a budget, without duplicates', async () => {
      Expenditure.distinct.mockResolvedValue([VALID_ID]);
      ProjectBudget.distinct.mockResolvedValue([VALID_ID, OTHER_ID]);

      const res = makeRes();
      await getProjectIdsWithExpenditure({}, res);

      expect(ProjectBudget.distinct).toHaveBeenCalledWith('projectId');
      expect(res.json).toHaveBeenCalledWith([VALID_ID, OTHER_ID]);
    });

    it('returns 200 with an empty array when no expenditure records exist', async () => {
      Expenditure.distinct.mockResolvedValue([]);

      const res = makeRes();
      await getProjectIdsWithExpenditure({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('returns 500 and calls logger on DB error', async () => {
      const error = new Error('DB failure');
      Expenditure.distinct.mockRejectedValue(error);

      const res = makeRes();
      await getProjectIdsWithExpenditure({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Failed to retrieve project IDs' });
      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'expenditureController.getProjectIdsWithExpenditure',
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('getProjectExpensesPie', () => {
    it('returns 400 for an invalid projectId without calling aggregate', async () => {
      const req = { params: { projectId: INVALID_ID } };
      const res = makeRes();

      await getProjectExpensesPie(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid project ID' });
      expect(Expenditure.aggregate).not.toHaveBeenCalled();
    });

    it('returns 400 for a short non-hex string without calling aggregate', async () => {
      const req = { params: { projectId: '12345' } };
      const res = makeRes();

      await getProjectExpensesPie(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(Expenditure.aggregate).not.toHaveBeenCalled();
    });

    it('returns actual amounts from records and planned amounts from the budget', async () => {
      Expenditure.aggregate.mockResolvedValue([
        { _id: 'Labor', amount: 1000 },
        { _id: 'Materials', amount: 500 },
      ]);
      getProjectBudget.mockResolvedValue({
        categories: { labor: 4000, materials: 3000, equipment: 2000 },
      });

      const req = { params: { projectId: VALID_ID } };
      const res = makeRes();

      await getProjectExpensesPie(req, res);

      // Only actual records are aggregated
      expect(Expenditure.aggregate.mock.calls[0][0][0].$match.type).toBe('actual');
      expect(getProjectBudget).toHaveBeenCalledWith(VALID_ID);
      expect(res.json).toHaveBeenCalledWith({
        actual: [
          { category: 'Labor', amount: 1000 },
          { category: 'Materials', amount: 500 },
        ],
        planned: [
          { category: 'Labor', amount: 4000 },
          { category: 'Materials', amount: 3000 },
          { category: 'Equipment', amount: 2000 },
        ],
        hasBudget: true,
      });
      // status should NOT be explicitly set to 200 (res.json implies 200)
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns no planned data and hasBudget false when no budget is set', async () => {
      Expenditure.aggregate.mockResolvedValue([]);

      const req = { params: { projectId: VALID_ID } };
      const res = makeRes();

      await getProjectExpensesPie(req, res);

      expect(res.json).toHaveBeenCalledWith({ actual: [], planned: [], hasBudget: false });
    });

    it('returns 500 and calls logger with projectId on DB error', async () => {
      const error = new Error('Aggregate failed');
      Expenditure.aggregate.mockRejectedValue(error);

      const req = { params: { projectId: VALID_ID } };
      const res = makeRes();

      await getProjectExpensesPie(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Server error retrieving expenses pie data.',
      });
      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'expenditureController.getProjectExpensesPie',
        { projectId: VALID_ID },
      );
    });
  });
});
