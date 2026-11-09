const mockController = {
  getProjectStatus: jest.fn((req, res) => res.status(200).json({ ok: true })),
  getFinancialOverview: jest.fn((req, res) => res.status(200).json({ ok: true })),
};

jest.mock('../../controllers/bmdashboard/weeklyProjectSummaryController', () => mockController);

const router = require('./weeklyProjectSummaryRouter');

describe('weeklyProjectSummaryRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['/project-status', 'getProjectStatus'],
    ['/financial-overview', 'getFinancialOverview'],
  ])('registers GET %s to the %s controller', (path, handlerName) => {
    const routeLayer = router.stack.find(
      (layer) => layer.route?.path === path && layer.route?.methods?.get,
    );

    expect(routeLayer).toBeDefined();
    expect(routeLayer.route.stack[0].handle).toBe(mockController[handlerName]);
  });
});
