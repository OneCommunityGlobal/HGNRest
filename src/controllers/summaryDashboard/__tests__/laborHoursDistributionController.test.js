jest.mock('../../../models/summaryDashboard/laborHours', () => ({
  aggregate: jest.fn(),
}));
jest.mock('../../../startup/logger', () => ({
  logException: jest.fn(),
}));
const mockCacheInstance = {
  hasCache: jest.fn(),
  getCache: jest.fn(),
  setCache: jest.fn(),
};
jest.mock('../../../utilities/nodeCache', () => () => mockCacheInstance);
jest.mock('../../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const LaborHours = require('../../../models/summaryDashboard/laborHours');
const logger = require('../../../startup/logger');
const { hasPermission } = require('../../../utilities/permissions');
const laborHoursDistributionController = require('../laborHoursDistributionController');

const getController = () => laborHoursDistributionController();

const makeReq = (query = {}, body = {}) => ({
  query: { start_date: '2024-01-01', end_date: '2024-01-31', ...query },
  body: { requestor: { requestorId: 'user-1' }, ...body },
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

describe('laborHoursDistributionController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheInstance.hasCache.mockReturnValue(false);
    mockCacheInstance.getCache.mockReturnValue({});
    hasPermission.mockResolvedValue(true);
  });

  describe('getLaborHoursDistribution', () => {
    it('returns 403 when user lacks getWeeklySummaries permission', async () => {
      hasPermission.mockResolvedValue(false);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      expect(hasPermission).toHaveBeenCalledWith(req.body.requestor, 'getWeeklySummaries');
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'You are not authorized to access labor hours distribution data',
      });
      expect(LaborHours.aggregate).not.toHaveBeenCalled();
    });

    it('returns 400 when start_date and end_date are missing', async () => {
      const controller = getController();
      const req = makeReq({ start_date: undefined, end_date: undefined });
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required query parameters: start_date and end_date are required',
      });
      expect(LaborHours.aggregate).not.toHaveBeenCalled();
    });

    it('returns 400 when start_date format is invalid', async () => {
      const controller = getController();
      const req = makeReq({ start_date: '01-01-2024', end_date: '2024-01-31' });
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid start_date format. Please use YYYY-MM-DD format',
      });
      expect(LaborHours.aggregate).not.toHaveBeenCalled();
    });

    it('returns 400 when start_date is not a valid calendar date', async () => {
      const controller = getController();
      const req = makeReq({ start_date: '2024-02-30', end_date: '2024-01-31' });
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid start_date: date does not exist (e.g., invalid month or day)',
      });
      expect(LaborHours.aggregate).not.toHaveBeenCalled();
    });

    it('returns 400 when end_date format is invalid', async () => {
      const controller = getController();
      const req = makeReq({ start_date: '2024-01-01', end_date: '31/01/2024' });
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid end_date format. Please use YYYY-MM-DD format',
      });
      expect(LaborHours.aggregate).not.toHaveBeenCalled();
    });

    it('returns 400 when end_date is not a valid calendar date', async () => {
      const controller = getController();
      const req = makeReq({ start_date: '2024-01-01', end_date: '2024-04-31' });
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid end_date: date does not exist (e.g., invalid month or day)',
      });
      expect(LaborHours.aggregate).not.toHaveBeenCalled();
    });

    it('returns 400 when start_date is after end_date', async () => {
      const controller = getController();
      const req = makeReq({ start_date: '2024-02-01', end_date: '2024-01-15' });
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid date range: start_date must be before or equal to end_date',
      });
      expect(LaborHours.aggregate).not.toHaveBeenCalled();
    });

    it('returns 200 with cached response when cache has key', async () => {
      const cached = {
        total_hours: 100,
        distribution: [{ category: 'A', hours: 100, percentage: 100 }],
      };
      mockCacheInstance.hasCache.mockReturnValue(true);
      mockCacheInstance.getCache.mockReturnValue(cached);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      expect(mockCacheInstance.hasCache).toHaveBeenCalled();
      expect(mockCacheInstance.getCache).toHaveBeenCalled();
      expect(LaborHours.aggregate).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(cached);
    });

    it('returns 200 with total_hours and distribution on success', async () => {
      LaborHours.aggregate.mockResolvedValue([
        { category: 'Team A', hours: 200 },
        { category: 'Team B', hours: 300 },
      ]);
      const controller = getController();
      const req = makeReq({ start_date: '2024-01-01', end_date: '2024-01-31' });
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      expect(LaborHours.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.total_hours).toBe(500);
      expect(payload.distribution).toHaveLength(2);
      expect(payload.distribution[0]).toEqual(
        expect.objectContaining({ category: 'Team A', hours: 200, percentage: 40 }),
      );
      expect(payload.distribution[1]).toEqual(
        expect.objectContaining({ category: 'Team B', hours: 300, percentage: 60 }),
      );
      expect(mockCacheInstance.setCache).toHaveBeenCalledWith(
        'labor_hours_distribution:2024-01-01:2024-01-31:all',
        payload,
      );
    });

    it('returns 200 with total_hours 0 and empty distribution when no data', async () => {
      LaborHours.aggregate.mockResolvedValue([]);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        total_hours: 0,
        distribution: [],
      });
    });

    it('includes optional category in cache key and pipeline when provided', async () => {
      LaborHours.aggregate.mockResolvedValue([{ category: 'Team A', hours: 100 }]);
      const controller = getController();
      const req = makeReq({ category: 'Construction' });
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      const pipeline = LaborHours.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match.category).toBe('Construction');
      expect(mockCacheInstance.setCache).toHaveBeenCalledWith(
        'labor_hours_distribution:2024-01-01:2024-01-31:Construction',
        expect.any(Object),
      );
    });

    it('returns 500 and calls logger on aggregate error', async () => {
      const error = new Error('DB connection failed');
      LaborHours.aggregate.mockRejectedValue(error);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getLaborHoursDistribution(req, res);

      expect(logger.logException).toHaveBeenCalledWith(error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Error fetching labor hours distribution data. Please try again.',
      });
    });
  });
});
