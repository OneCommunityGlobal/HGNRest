process.env.TZ = 'UTC';

const mockAggregate = jest.fn();
const mockCountDocuments = jest.fn();

jest.mock('../../../models/bmdashboard/issueAnalytics', () => ({
  aggregate: (...args) => mockAggregate(...args),
  countDocuments: (...args) => mockCountDocuments(...args),
}));

const IssueAnalyticsController = require('../issueAnalyticsController');

const { getIssueTrends, getIssueSummary } = IssueAnalyticsController();

const FIXED_NOW = new Date('2025-06-15T12:00:00.000Z');

describe('issueAnalyticsController', () => {
  let req;
  let res;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('getIssueTrends', () => {
    it('uses the default range when no query params are provided and returns the aggregated trends', async () => {
      const trendsResult = [{ week: '2025-06-02', created: 3, resolved: 1 }];
      mockAggregate.mockResolvedValue(trendsResult);

      await getIssueTrends(req, res);

      expect(mockAggregate).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual(trendsResult);
      expect(payload.meta.startDate).toBeInstanceOf(Date);
      expect(payload.meta.endDate).toBeInstanceOf(Date);
      expect(payload.meta.weeks).toBeGreaterThan(0);

      const pipeline = mockAggregate.mock.calls[0][0];
      expect(pipeline[pipeline.length - 1]).toEqual({ $limit: payload.meta.weeks });
    });

    it('treats an out-of-range weeks value the same as the default weeks preset', async () => {
      mockAggregate.mockResolvedValue([]);
      req.query.weeks = '20';
      await getIssueTrends(req, res);
      const fallbackWeeks = res.json.mock.calls[0][0].meta.weeks;

      jest.clearAllMocks();
      req = { query: {} };
      mockAggregate.mockResolvedValue([]);
      await getIssueTrends(req, res);
      const defaultWeeks = res.json.mock.calls[0][0].meta.weeks;

      expect(fallbackWeeks).toBe(defaultWeeks);
    });

    it.each(['4', '8', '12'])('accepts weeks=%s as a valid preset', async (weeksValue) => {
      mockAggregate.mockResolvedValue([]);
      req.query.weeks = weeksValue;

      await getIssueTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockAggregate).toHaveBeenCalledTimes(1);
    });

    it('accepts only a valid start date', async () => {
      mockAggregate.mockResolvedValue([]);
      req.query.start = '2025-06-01';

      await getIssueTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockAggregate).toHaveBeenCalledTimes(1);
    });

    it('returns 400 for an invalid start date', async () => {
      req.query.start = 'not-a-date';

      await getIssueTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid start date' });
      expect(mockAggregate).not.toHaveBeenCalled();
    });

    it('accepts only a valid end date', async () => {
      mockAggregate.mockResolvedValue([]);
      req.query.end = '2025-06-10';

      await getIssueTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockAggregate).toHaveBeenCalledTimes(1);
    });

    it('returns 400 for an invalid end date', async () => {
      req.query.end = 'garbage';

      await getIssueTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid end date' });
      expect(mockAggregate).not.toHaveBeenCalled();
    });

    it('accepts both a valid start and end date', async () => {
      mockAggregate.mockResolvedValue([]);
      req.query.start = '2025-06-01';
      req.query.end = '2025-06-10';

      await getIssueTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockAggregate).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when both start and end are invalid', async () => {
      req.query.start = 'nope';
      req.query.end = 'also-nope';

      await getIssueTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid date format' });
      expect(mockAggregate).not.toHaveBeenCalled();
    });

    it('returns 400 when start date is not before end date', async () => {
      req.query.start = '2025-06-10';
      req.query.end = '2025-06-01';

      await getIssueTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Start date must be before end date' });
      expect(mockAggregate).not.toHaveBeenCalled();
    });

    it('clamps the range to MAX_WEEKS when the requested range exceeds 12 weeks', async () => {
      mockAggregate.mockResolvedValue([]);
      req.query.start = '2025-01-01';
      req.query.end = '2025-10-01';

      await getIssueTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.meta.weeks).toBeLessThanOrEqual(13);
      expect(payload.meta.startDate.getTime()).toBeGreaterThan(new Date('2025-01-01').getTime());
    });

    it('returns 500 with the error message when aggregation fails', async () => {
      mockAggregate.mockRejectedValue(new Error('db exploded'));

      await getIssueTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'db exploded' });
    });

    it('falls back to a generic error message when the rejection has no message', async () => {
      mockAggregate.mockRejectedValue('boom');

      await getIssueTrends(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Server error' });
    });
  });

  describe('getIssueSummary', () => {
    beforeEach(() => {
      mockCountDocuments.mockResolvedValue(0);
      mockAggregate.mockResolvedValue([]);
    });

    it('uses the default 8-week range and returns aggregated KPI data', async () => {
      mockCountDocuments
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(3);
      mockAggregate.mockResolvedValue([{ averageResolutionTimeDays: 2.4567 }]);

      await getIssueSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalIssues: 10,
          newIssues: 4,
          resolvedIssues: 3,
          averageResolutionTimeDays: 2.46,
        },
      });
    });

    it('returns 0 average resolution time when there are no resolved issues in range', async () => {
      mockAggregate.mockResolvedValue([]);

      await getIssueSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.averageResolutionTimeDays).toBe(0);
    });

    it('accepts a valid weeks value', async () => {
      req.query.weeks = '4';

      await getIssueSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCountDocuments).toHaveBeenCalledTimes(3);
    });

    it('falls back to the default weeks when the weeks value is not numeric', async () => {
      req.query.weeks = 'abc';

      await getIssueSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCountDocuments).toHaveBeenCalledTimes(3);
    });

    it('accepts explicit start and end dates', async () => {
      req.query.start = '2025-06-01';
      req.query.end = '2025-06-10';

      await getIssueSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCountDocuments).toHaveBeenCalledTimes(3);
    });

    it('returns 400 when only a start date is provided without weeks', async () => {
      req.query.start = '2025-06-01';

      await getIssueSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required query parameters: start/end or weeks',
      });
      expect(mockCountDocuments).not.toHaveBeenCalled();
    });

    it('returns 400 when only an end date is provided without weeks', async () => {
      req.query.end = '2025-06-10';

      await getIssueSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required query parameters: start/end or weeks',
      });
      expect(mockCountDocuments).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid start/end date format', async () => {
      req.query.start = 'nope';
      req.query.end = 'also-nope';

      await getIssueSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid date format' });
      expect(mockCountDocuments).not.toHaveBeenCalled();
    });

    it('returns 400 when the requested range exceeds MAX_WEEKS', async () => {
      req.query.start = '2025-01-01';
      req.query.end = '2025-06-01';

      await getIssueSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Date range cannot exceed 12 weeks.' });
      expect(mockCountDocuments).not.toHaveBeenCalled();
    });

    it('returns 500 with the error message when a query fails', async () => {
      mockCountDocuments.mockRejectedValueOnce(new Error('count failed'));

      await getIssueSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'count failed' });
    });

    it('falls back to a generic error message when the rejection has no message', async () => {
      mockCountDocuments.mockRejectedValueOnce('boom');

      await getIssueSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Server error' });
    });
  });
});
