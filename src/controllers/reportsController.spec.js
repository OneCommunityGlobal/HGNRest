jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const mockOverviewHelper = jest.fn();

jest.mock('../helpers/overviewReportHelper', () => jest.fn(() => mockOverviewHelper));

// const overviewReportHelperClosure = require('../helpers/overviewReportHelper');
const reportsControllerClosure = require('./reportsController');
// const reporthelperClosure = require('../helpers/reporthelper');
const helper = require('../utilities/permissions');
// const cacheModule = require('../utilities/nodeCache');
const { mockReq, mockRes, assertResMock } = require('../test');

jest.mock('../helpers/overviewReportHelper');
jest.mock('../helpers/reporthelper');
jest.mock('../utilities/nodeCache', () =>
  jest.fn(() => ({
    removeCache: jest.fn(),
    hasCache: jest.fn(),
    getCache: jest.fn(),
    setCache: jest.fn(),
    setKeyTimeToLive: jest.fn(),
  })),
);

const makeSut = () => {
  const {
    getVolunteerTrends,
    getVolunteerStatsData,
    getWeeklySummaries,
    getVolunteerStats,
    getVolunteerHoursStats,
    getVolunteerRoleStats,
    getTaskAndProjectStats,
  } = reportsControllerClosure();
  return {
    getVolunteerTrends,
    getVolunteerStatsData,
    getWeeklySummaries,
    getVolunteerStats,
    getVolunteerHoursStats,
    getVolunteerRoleStats,
    getTaskAndProjectStats,
  };
};

// const flushPromises = () => new Promise(setImmediate);

describe('reportsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getVolunteerTrends', () => {
    test('returns 400 if missing timeframe or offset', async () => {
      const { getVolunteerTrends } = makeSut();
      const newMockReq = { query: {} };
      const response = await getVolunteerTrends(newMockReq, mockRes);
      assertResMock(400, { msg: 'Please provide a timeframe and offset' }, response, mockRes);
    });

    test('returns 400 if invalid timeframe', async () => {
      const { getVolunteerTrends } = makeSut();
      const newMockReq = { query: { timeFrame: 99, offset: 'week' } };
      const response = await getVolunteerTrends(newMockReq, mockRes);
      assertResMock(400, { msg: 'Invalid timeFrame' }, response, mockRes);
    });

    test('returns 400 if invalid offset', async () => {
      const { getVolunteerTrends } = makeSut();
      const newMockReq = { query: { timeFrame: 1, offset: 'day' } };
      const response = await getVolunteerTrends(newMockReq, mockRes);
      assertResMock(
        400,
        { msg: 'Offset param must either be `week` or `month`' },
        response,
        mockRes,
      );
    });

    /* test('returns 200 if helper resolves', async () => {
      mockOverviewHelper.mockResolvedValueOnce({ some: 'data' });

      const req = { query: { timeframe: 'weekly' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await reportsController.getVolunteerTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ some: 'data' });
    }); */

    /* test('returns 400 if helper rejects', async () => {
      const { getVolunteerTrends } = makeSut();
      overviewReportHelperClosure.mockReturnValue({
        getVolunteerTrends: jest.fn().mockRejectedValue(new Error('fail')),
      });

      const newMockReq = { query: { timeFrame: 1, offset: 'week' } };
      const response = await getVolunteerTrends(newMockReq, mockRes);
      await flushPromises();
      assertResMock(400, new Error('fail'), response, mockRes);
    }); */
  });

  describe('getWeeklySummaries', () => {
    test('returns 403 if no permission', async () => {
      const { getWeeklySummaries } = makeSut();
      helper.hasPermission.mockResolvedValue(false);
      const response = await getWeeklySummaries(mockReq, mockRes);
      assertResMock(403, 'You are not authorized to view all users', response, mockRes);
    });

    /* test('returns 200 if cache hit', async () => {
      const { getWeeklySummaries } = makeSut();
      helper.hasPermission.mockResolvedValue(true);
      const cache = cacheModule();
      cache.hasCache.mockReturnValue(true);
      cache.getCache.mockReturnValue(['cachedData']);

      const newMockReq = { body: mockReq.body, query: { week: 0 } };
      const response = await getWeeklySummaries(newMockReq, mockRes);
      assertResMock(200, ['cachedData'], response, mockRes);
    }); */

    /* test('returns 200 if helper returns summaries', async () => {
      const { getWeeklySummaries } = makeSut();
      helper.hasPermission.mockResolvedValue(true);
      reporthelperClosure.mockReturnValue({
        weeklySummaries: jest.fn().mockResolvedValue([{ foo: 'bar' }]),
        formatSummaries: jest.fn().mockReturnValue([{ formatted: true }]),
      });

      const newMockReq = { body: mockReq.body, query: { week: 0, forceRefresh: 'true' } };
      const response = await getWeeklySummaries(newMockReq, mockRes);
      await flushPromises();
      assertResMock(200, [{ formatted: true }], response, mockRes);
    }); */

    /* test('returns 404 if helper throws', async () => {
      const { getWeeklySummaries } = makeSut();
      helper.hasPermission.mockResolvedValue(true);
      reporthelperClosure.mockReturnValue({
        weeklySummaries: jest.fn().mockRejectedValue(new Error('fail')),
        formatSummaries: jest.fn(),
      });

      const newMockReq = { body: mockReq.body, query: { week: 0, forceRefresh: 'true' } };
      const response = await getWeeklySummaries(newMockReq, mockRes);
      await flushPromises();
      assertResMock(404, new Error('fail'), response, mockRes);
    }); */
  });

  describe('getVolunteerStats', () => {
    test('returns 400 if missing dates', async () => {
      const { getVolunteerStats } = makeSut();
      const newMockReq = { query: {} };
      const response = await getVolunteerStats(newMockReq, mockRes);
      assertResMock(400, 'Please provide startDate and endDate', response, mockRes);
    });

    /*     test('returns 200 if all helpers succeed', async () => {
      const { getVolunteerStats } = makeSut();
      overviewReportHelperClosure.mockReturnValue({
        getFourPlusMembersTeamCount: jest.fn().mockResolvedValue(5),
        getTotalBadgesAwardedCount: jest.fn().mockResolvedValue([{ badgeCollection: 7 }]),
        getAnniversaryCount: jest.fn().mockResolvedValue([{ anniversaryCount: 3 }]),
        getTeamMembersCount: jest.fn().mockResolvedValue(2),
        getActiveInactiveUsersCount: jest.fn().mockResolvedValue(9),
      });

      const newMockReq = { query: { startDate: '2024-01-01', endDate: '2024-01-02' } };
      const response = await getVolunteerStats(newMockReq, mockRes);
      await flushPromises();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    }); */

    /* test('returns 404 if helper throws', async () => {
      const { getVolunteerStats } = makeSut();
      overviewReportHelperClosure.mockReturnValue({
        getFourPlusMembersTeamCount: jest.fn().mockRejectedValue(new Error('fail')),
      });

      const newMockReq = { query: { startDate: '2024-01-01', endDate: '2024-01-02' } };
      const response = await getVolunteerStats(newMockReq, mockRes);
      await flushPromises();
      assertResMock(404, new Error('fail'), response, mockRes);
    }); */
  });

  describe('getVolunteerStatsData', () => {
    test('returns 400 if missing timeframe', async () => {
      const { getVolunteerStatsData } = makeSut();
      const newMockReq = { query: {} };
      const response = await getVolunteerStatsData(newMockReq, mockRes);
      assertResMock(400, { msg: 'Please provide a start and end date' }, response, mockRes);
    });

    /* test('returns 200 with helper data', async () => {
      const { getVolunteerStatsData } = makeSut();
      const mockData = [{ stats: 'data' }];
      overviewReportHelperClosure.mockReturnValue({
        getVolunteerStatsData: jest.fn().mockResolvedValue(mockData),
      });

      const newMockReq = { query: { timeframe: 'weekly' } };
      const response = await getVolunteerStatsData(newMockReq, mockRes);
      await flushPromises();
      assertResMock(200, mockData, response, mockRes);
    }); */

    /* test('returns 400 if helper rejects', async () => {
      const { getVolunteerStatsData } = makeSut();
      const newMockReq = { query: { startDate: '2023-01-01', endDate: '2023-12-31' } };
      const mockHelper = {
        getVolunteerStatsData: jest.fn().mockRejectedValueOnce(new Error('fail')),
      };
      overviewReportHelperClosure.mockReturnValueOnce(mockHelper);
      overviewReportHelperClosure.mockReturnValueOnce(mockHelper);
      const response = await getVolunteerStatsData(newMockReq, mockRes);
      assertResMock(400, 'fail', response, mockRes);
    }); */
  });

  describe('getVolunteerHoursStats', () => {
    test('returns 400 if missing dates', async () => {
      const { getVolunteerHoursStats } = makeSut();
      const newMockReq = { query: {} };
      const response = await getVolunteerHoursStats(newMockReq, mockRes);
      assertResMock(400, 'Please provide startDate and endDate', response, mockRes);
    });

    /* test('returns 200 with helper data', async () => {
      const { getVolunteerHoursStats } = makeSut();
      const mockData = { totalHours: 120 };
      overviewReportHelperClosure.mockReturnValue({
        getVolunteerHoursStats: jest.fn().mockResolvedValue(mockData),
      });

      const newMockReq = { query: { startDate: '2024-01-01', endDate: '2024-02-01' } };
      const response = await getVolunteerHoursStats(newMockReq, mockRes);
      await flushPromises();
      assertResMock(200, mockData, response, mockRes);
    }); */

    /* test('returns 404 if helper throws', async () => {
      const { getVolunteerHoursStats } = makeSut();
      overviewReportHelperClosure.mockReturnValue({
        getVolunteerHoursStats: jest.fn().mockRejectedValue(new Error('fail')),
      });

      const newMockReq = { query: { startDate: '2024-01-01', endDate: '2024-02-01' } };
      const response = await getVolunteerHoursStats(newMockReq, mockRes);
      await flushPromises();
      assertResMock(404, new Error('fail'), response, mockRes);
    }); */
  });

  describe('getVolunteerRoleStats', () => {
    test('returns 400 if missing dates', async () => {
      const { getVolunteerRoleStats } = makeSut();
      const newMockReq = { query: {} };
      const response = await getVolunteerRoleStats(newMockReq, mockRes);
      assertResMock(400, 'Please provide startDate and endDate', response, mockRes);
    });

    /* test('returns 200 with helper data', async () => {
      const { getVolunteerRoleStats } = makeSut();
      const mockData = [{ role: 'developer', count: 5 }];
      overviewReportHelperClosure.mockReturnValue({
        getVolunteerRoleStats: jest.fn().mockResolvedValue(mockData),
      });

      const newMockReq = { query: { startDate: '2024-01-01', endDate: '2024-01-31' } };
      const response = await getVolunteerRoleStats(newMockReq, mockRes);
      await flushPromises();
      assertResMock(200, mockData, response, mockRes);
    }); */

    /* test('returns 404 if helper throws', async () => {
      const { getVolunteerRoleStats } = makeSut();
      overviewReportHelperClosure.mockReturnValue({
        getVolunteerRoleStats: jest.fn().mockRejectedValue(new Error('fail')),
      });

      const newMockReq = { query: { startDate: '2024-01-01', endDate: '2024-01-31' } };
      const response = await getVolunteerRoleStats(newMockReq, mockRes);
      await flushPromises();
      assertResMock(404, new Error('fail'), response, mockRes);
    }); */
  });

  describe('getTaskAndProjectStats', () => {
    test('returns 400 if missing dates', async () => {
      const { getTaskAndProjectStats } = makeSut();
      const newMockReq = { query: {} };
      const response = await getTaskAndProjectStats(newMockReq, mockRes);
      assertResMock(400, 'Please provide startDate and endDate', response, mockRes);
    });

    /* test('returns 200 with helper data', async () => {
      const { getTaskAndProjectStats } = makeSut();
      const mockData = { tasks: 10, projects: 3 };
      overviewReportHelperClosure.mockReturnValue({
        getTaskAndProjectStats: jest.fn().mockResolvedValue(mockData),
      });

      const newMockReq = { query: { startDate: '2024-01-01', endDate: '2024-01-31' } };
      const response = await getTaskAndProjectStats(newMockReq, mockRes);
      await flushPromises();
      assertResMock(200, mockData, response, mockRes);
    }); */

    /* test('returns 404 if helper throws', async () => {
      const { getTaskAndProjectStats } = makeSut();
      overviewReportHelperClosure.mockReturnValue({
        getTaskAndProjectStats: jest.fn().mockRejectedValue(new Error('fail')),
      });

      const newMockReq = { query: { startDate: '2024-01-01', endDate: '2024-01-31' } };
      const response = await getTaskAndProjectStats(newMockReq, mockRes);
      await flushPromises();
      assertResMock(404, new Error('fail'), response, mockRes);
    }); */
  });
});
