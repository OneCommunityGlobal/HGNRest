jest.mock('../../../models/bmdashboard/buildingProject', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../utilities/projectBudgetHelper', () => ({
  ...jest.requireActual('../../../utilities/projectBudgetHelper'),
  getProjectBudget: jest.fn(),
}));

jest.mock('../../../models/bmdashboard/projectBudget', () => ({}));

const BuildingProject = require('../../../models/bmdashboard/buildingProject');
const { getProjectBudget } = require('../../../utilities/projectBudgetHelper');
const { getExpensesByProject } = require('../bmActualVsPlannedCostController');

const PROJECT_ID = '507f1f77bcf86cd799439011';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

const plannedByCategory = (payload) =>
  Object.fromEntries(payload.breakdown.map((item) => [item.category, item.plannedCost]));

describe('bmActualVsPlannedCostController.getExpensesByProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    BuildingProject.findById.mockReturnValue({
      lean: () => Promise.resolve({ name: 'Building 3', members: [], materials: [] }),
    });
  });

  it('uses the saved budget for planned costs', async () => {
    getProjectBudget.mockResolvedValue({
      categories: { labor: 4000, materials: 3000, equipment: 2000 },
    });
    const res = makeRes();

    await getExpensesByProject({ params: { projectId: PROJECT_ID } }, res);

    const payload = res.json.mock.calls[0][0];
    expect(getProjectBudget).toHaveBeenCalledWith(PROJECT_ID);
    expect(payload.totalPlannedCost).toBe(9000);
    expect(payload.hasBudget).toBe(true);
    expect(plannedByCategory(payload)).toEqual({ Labor: 4000, Equipment: 2000, Materials: 3000 });
  });

  it('reports 0 planned and hasBudget false when no budget is set', async () => {
    getProjectBudget.mockResolvedValue(null);
    const res = makeRes();

    await getExpensesByProject({ params: { projectId: PROJECT_ID } }, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.totalPlannedCost).toBe(0);
    expect(payload.hasBudget).toBe(false);
    expect(plannedByCategory(payload)).toEqual({ Labor: 0, Equipment: 0, Materials: 0 });
  });

  it('returns 404 when the project does not exist', async () => {
    BuildingProject.findById.mockReturnValue({ lean: () => Promise.resolve(null) });
    const res = makeRes();

    await getExpensesByProject({ params: { projectId: PROJECT_ID } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(getProjectBudget).not.toHaveBeenCalled();
  });
});
