const analyticsControllerFactory = require('../applicantAnalyticsController');

describe('applicantAnalyticsController - getDeviceBreakdown', () => {
  let mockAnonymousInteraction;
  let controller;
  let req;
  let res;

  beforeEach(() => {
    mockAnonymousInteraction = {
      aggregate: jest.fn(),
    };

    controller = analyticsControllerFactory(
      {}, // Applicant (unused here)
      mockAnonymousInteraction,
      {}, // AnonymousApplication (unused here)
      {}, // AnalyticsSummary (unused here)
    );

    req = {
      body: { requestor: { role: 'Administrator' } },
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 403 when requestor is not Owner or Administrator', async () => {
    req.body.requestor.role = 'Volunteer';

    await controller.getDeviceBreakdown(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(mockAnonymousInteraction.aggregate).not.toHaveBeenCalled();
  });

  it('returns 400 when startDate or endDate is missing', async () => {
    req.query = { startDate: '2024-06-01' };

    await controller.getDeviceBreakdown(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'startDate and endDate are required' });
  });

  it('returns 400 when dates are invalid', async () => {
    req.query = { startDate: 'not-a-date', endDate: '2024-06-30' };

    await controller.getDeviceBreakdown(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid date format' });
  });

  it('returns 400 when startDate is after endDate', async () => {
    req.query = { startDate: '2024-06-30', endDate: '2024-06-01' };

    await controller.getDeviceBreakdown(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid date range: startDate cannot be after endDate',
    });
  });

  it('computes sessions, bounce rate, and avg engagement time per device', async () => {
    req.query = { startDate: '2024-06-01', endDate: '2024-06-30' };

    mockAnonymousInteraction.aggregate
      .mockResolvedValueOnce([
        { _id: 'desktop', sessions: 80, bouncedSessions: 20, avgEngagementTime: 300 },
        { _id: 'mobile', sessions: 20, bouncedSessions: 15, avgEngagementTime: 90 },
      ])
      .mockResolvedValueOnce([
        { _id: 'desktop', sessions: 60, bouncedSessions: 10, avgEngagementTime: 280 },
        { _id: 'tablet', sessions: 40, bouncedSessions: 5, avgEngagementTime: 200 },
      ]);

    await controller.getDeviceBreakdown(req, res);

    expect(mockAnonymousInteraction.aggregate).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);

    const response = res.json.mock.calls[0][0];
    expect(response.deviceBreakdown).toHaveLength(3);

    const desktop = response.deviceBreakdown.find(d => d.name === 'Desktop');
    expect(desktop.sessions).toBe(80);
    expect(desktop.bounceRate).toBe(25);
    expect(desktop.avgEngagementTime).toBe(300);
    expect(desktop.value).toBe(80);
    expect(desktop.previousValue).toBe(60);

    const mobile = response.deviceBreakdown.find(d => d.name === 'Mobile');
    expect(mobile.sessions).toBe(20);
    expect(mobile.bounceRate).toBe(75);
    expect(mobile.value).toBe(20);
    expect(mobile.previousValue).toBe(0);

    const tablet = response.deviceBreakdown.find(d => d.name === 'Tablet');
    expect(tablet.sessions).toBe(0);
    expect(tablet.bounceRate).toBe(0);
    expect(tablet.previousValue).toBe(40);
  });

  it('returns zeroed-out breakdown when there is no data at all', async () => {
    req.query = { startDate: '2024-06-01', endDate: '2024-06-30' };
    mockAnonymousInteraction.aggregate.mockResolvedValue([]);

    await controller.getDeviceBreakdown(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.deviceBreakdown).toHaveLength(3);
    response.deviceBreakdown.forEach(device => {
      expect(device.sessions).toBe(0);
      expect(device.bounceRate).toBe(0);
      expect(device.value).toBe(0);
      expect(device.previousValue).toBe(0);
      expect(device.avgEngagementTime).toBe(0);
    });
  });

  it('returns 500 when the aggregation throws', async () => {
    req.query = { startDate: '2024-06-01', endDate: '2024-06-30' };
    mockAnonymousInteraction.aggregate.mockRejectedValue(new Error('DB error'));

    await controller.getDeviceBreakdown(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  });
});
