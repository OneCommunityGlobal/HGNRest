jest.mock('../../../models/bmdashboard/buildingProject', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../models/bmdashboard/expenditure', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../../../startup/logger', () => ({
  logException: jest.fn(),
}));

const BuildingProject = require('../../../models/bmdashboard/buildingProject');
const Expenditure = require('../../../models/bmdashboard/expenditure');
const logger = require('../../../startup/logger');
const { getExpensesByProject } = require('../bmActualVsPlannedCostController');

const PROJECT_ID = '507f1f77bcf86cd799439011';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

describe('bmActualVsPlannedCostController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns expenditure-backed actual and planned totals by category', async () => {
    BuildingProject.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ name: 'Building 3' }),
    });
    Expenditure.aggregate.mockResolvedValue([
      { _id: { type: 'actual', category: 'Labor' }, amount: 800000 },
      { _id: { type: 'actual', category: 'Materials' }, amount: 33310 },
      { _id: { type: 'planned', category: 'Labor' }, amount: 5000 },
      { _id: { type: 'planned', category: 'Materials' }, amount: 3445 },
    ]);

    const res = makeRes();
    await getExpensesByProject({ params: { projectId: PROJECT_ID } }, res);

    const [{ $match: match }] = Expenditure.aggregate.mock.calls[0][0];
    expect(match.projectId.toString()).toBe(PROJECT_ID);
    expect(res.json).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      projectName: 'Building 3',
      totalActualCost: 833310,
      totalPlannedCost: 8445,
      breakdown: [
        { category: 'Labor', actualCost: 800000, plannedCost: 5000 },
        { category: 'Equipment', actualCost: 0, plannedCost: 0 },
        { category: 'Materials', actualCost: 33310, plannedCost: 3445 },
      ],
    });
  });

  it('rejects an invalid project ID without querying the database', async () => {
    const res = makeRes();
    await getExpensesByProject({ params: { projectId: 'invalid' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid project ID' });
    expect(BuildingProject.findById).not.toHaveBeenCalled();
    expect(Expenditure.aggregate).not.toHaveBeenCalled();
  });

  it('returns zero costs when a project has no expenditure records', async () => {
    BuildingProject.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ name: 'Building 3' }),
    });
    Expenditure.aggregate.mockResolvedValue([]);

    const res = makeRes();
    await getExpensesByProject({ params: { projectId: PROJECT_ID } }, res);

    expect(res.json).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      projectName: 'Building 3',
      totalActualCost: 0,
      totalPlannedCost: 0,
      breakdown: [
        { category: 'Labor', actualCost: 0, plannedCost: 0 },
        { category: 'Equipment', actualCost: 0, plannedCost: 0 },
        { category: 'Materials', actualCost: 0, plannedCost: 0 },
      ],
    });
  });

  it('logs and returns an error when data retrieval fails', async () => {
    const error = new Error('Database failure');
    BuildingProject.findById.mockReturnValue({
      lean: jest.fn().mockRejectedValue(error),
    });

    const res = makeRes();
    await getExpensesByProject({ params: { projectId: PROJECT_ID } }, res);

    expect(logger.logException).toHaveBeenCalledWith(
      error,
      'bmActualVsPlannedCostController.getExpensesByProject',
      { projectId: PROJECT_ID },
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  });
});
