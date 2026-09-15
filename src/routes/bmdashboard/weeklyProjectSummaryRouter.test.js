const mockController = {
  getProjectStatus: jest.fn((req, res) => res.status(200).json({ ok: true })),
};

jest.mock('../../controllers/bmdashboard/weeklyProjectSummaryController', () => mockController);

const router = require('./weeklyProjectSummaryRouter');

describe('weeklyProjectSummaryRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registers GET /project-status to the project status controller', () => {
    const routeLayer = router.stack.find(
      (layer) => layer.route?.path === '/project-status' && layer.route?.methods?.get,
    );

    expect(routeLayer).toBeDefined();
    expect(routeLayer.route.stack[0].handle).toBe(mockController.getProjectStatus);
  });
});
