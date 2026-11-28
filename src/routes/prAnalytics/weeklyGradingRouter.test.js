jest.mock('../../controllers/prAnalytics/weeklyGradingController', () =>
  jest.fn(() => ({
    getWeeklyGrading: jest.fn(),
    saveWeeklyGrading: jest.fn(),
    deleteWeeklyGrading: jest.fn(),
  })),
);

const weeklyGradingRouterFactory = require('./weeklyGradingRouter');

describe('weeklyGradingRouter', () => {
  it('registers GET, DELETE, and POST routes', () => {
    const mockModel = {};
    const router = weeklyGradingRouterFactory(mockModel);

    const routes = router.stack.map((layer) => ({
      path: layer.route?.path,
      methods: layer.route ? Object.keys(layer.route.methods) : [],
    }));

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/weekly-grading',
          methods: expect.arrayContaining(['get']),
        }),
        expect.objectContaining({
          path: '/weekly-grading',
          methods: expect.arrayContaining(['delete']),
        }),
        expect.objectContaining({
          path: '/weekly-grading/save',
          methods: expect.arrayContaining(['post']),
        }),
      ]),
    );
  });
});
