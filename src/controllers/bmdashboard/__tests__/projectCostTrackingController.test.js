jest.mock('../../../utilities/projectBudgetHelper', () => ({
  ...jest.requireActual('../../../utilities/projectBudgetHelper'),
  getProjectBudget: jest.fn(),
}));

jest.mock('../../../models/bmdashboard/projectBudget', () => ({}));

const { getProjectBudget } = require('../../../utilities/projectBudgetHelper');
const projectCostTrackingController = require('../projectCostTrackingController');

const PROJECT_ID = '507f1f77bcf86cd799439011';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

const ProjectCostTracking = {
  find: jest.fn(() => ({ sort: () => Promise.resolve([]) })),
};

describe('projectCostTrackingController.getProjectCosts plannedBudget', () => {
  const { getProjectCosts } = projectCostTrackingController(ProjectCostTracking);

  beforeEach(() => jest.clearAllMocks());

  it('returns the budget total as plannedBudget', async () => {
    getProjectBudget.mockResolvedValue({
      categories: { labor: 4000, materials: 3000, equipment: 2000 },
    });
    const res = makeRes();

    await getProjectCosts({ params: { id: PROJECT_ID }, query: {} }, res);

    expect(getProjectBudget).toHaveBeenCalledWith(PROJECT_ID);
    const payload = res.json.mock.calls[0][0];
    expect(payload.plannedBudget).toBe(9000);
    expect(payload.hasBudget).toBe(true);
  });

  it('returns null instead of a made-up number when no budget is set', async () => {
    getProjectBudget.mockResolvedValue(null);
    const res = makeRes();

    await getProjectCosts({ params: { id: PROJECT_ID }, query: {} }, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.plannedBudget).toBeNull();
    expect(payload.hasBudget).toBe(false);
  });
});
