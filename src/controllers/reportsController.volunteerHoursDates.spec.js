const mockGetHoursStats = jest.fn();
const mockGetCommittedHoursStats = jest.fn();
const mockGetTotalHoursWorked = jest.fn();

jest.mock(
  '../helpers/overviewReportHelper',
  () => () =>
    new Proxy(
      {
        getHoursStats: mockGetHoursStats,
        getCommittedHoursStats: mockGetCommittedHoursStats,
        getTotalHoursWorked: mockGetTotalHoursWorked,
      },
      {
        get(target, property) {
          return target[property] || jest.fn().mockResolvedValue({});
        },
      },
    ),
);

jest.mock('../utilities/nodeCache', () => () => ({
  hasCache: jest.fn().mockReturnValue(false),
  getCache: jest.fn(),
  setCache: jest.fn(),
  setKeyTimeToLive: jest.fn(),
  removeCache: jest.fn(),
}));

const reportsController = require('./reportsController');

describe('getVolunteerStatsData volunteer-hours date flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHoursStats.mockResolvedValue([]);
    mockGetCommittedHoursStats.mockResolvedValue([]);
    mockGetTotalHoursWorked.mockResolvedValue({ current: 0 });
  });

  test.each([
    ['Current Week', '2026-07-26', '2026-07-31'],
    ['Previous Week', '2026-07-19', '2026-07-25'],
    ['custom range', '2026-07-05', '2026-07-11'],
  ])('passes canonical strings for %s', async (label, startDate, endDate) => {
    const req = {
      query: {
        startDate,
        endDate,
        comparisonStartDate: '2026-06-21',
        comparisonEndDate: '2026-06-27',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await reportsController().getVolunteerStatsData(req, res);

    expect(mockGetHoursStats).toHaveBeenCalledWith(
      startDate,
      endDate,
      '2026-06-21',
      '2026-06-27',
    );
    expect(mockGetCommittedHoursStats).toHaveBeenCalledWith();
    expect(mockGetTotalHoursWorked).toHaveBeenCalledWith(startDate, endDate);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns distinct worked and committed distribution fields with a legacy worked alias', async () => {
    const workedStats = [{ _id: '10', count: 1 }];
    const committedStats = [{ _id: 10, count: 2 }];
    mockGetHoursStats.mockResolvedValue(workedStats);
    mockGetCommittedHoursStats.mockResolvedValue(committedStats);
    const req = { query: { startDate: '2026-07-19', endDate: '2026-07-25' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await reportsController().getVolunteerStatsData(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        volunteerHoursStats: workedStats,
        volunteerWorkedHoursStats: workedStats,
        volunteerCommittedHoursStats: committedStats,
      }),
    );
  });
});
