jest.mock('../../helpers/reporthelper', () => jest.fn(() => ({})));

jest.mock('../../helpers/overviewReportHelper', () => {
  const getBlueSquareStats = jest.fn();
  const factory = jest.fn(() => ({
    getBlueSquareStats,
  }));
  factory.__mockGetBlueSquareStats = getBlueSquareStats;
  return factory;
});

jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

jest.mock('../../models/userProfile', () => ({
  find: jest.fn(),
}));

jest.mock('../../utilities/emailSender', () => jest.fn());

jest.mock('../../utilities/nodeCache', () =>
  jest.fn(() => ({
    hasCache: jest.fn(() => false),
    getCache: jest.fn(),
    setCache: jest.fn(),
    removeCache: jest.fn(),
  })),
);

jest.mock('../../utilities/playwrightUtil', () => jest.fn());

const overviewReportHelperClosure = require('../../helpers/overviewReportHelper');
const reportsControllerFactory = require('../reportsController');

describe('reportsController.getBlueSquareStats', () => {
  let controller;
  let res;
  let getBlueSquareStatsMock;

  beforeEach(() => {
    jest.clearAllMocks();
    getBlueSquareStatsMock = overviewReportHelperClosure.__mockGetBlueSquareStats;
    controller = reportsControllerFactory();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  it('returns 400 when startDate or endDate is missing', async () => {
    const req = { query: { startDate: '2026-08-01' } };

    await controller.getBlueSquareStats(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Please provide startDate and endDate');
    expect(getBlueSquareStatsMock).not.toHaveBeenCalled();
  });

  it('returns 400 when startDate/endDate format is invalid', async () => {
    const req = { query: { startDate: 'not-a-date', endDate: '2026-08-07' } };

    await controller.getBlueSquareStats(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      'Please provide valid startDate and endDate in YYYY-MM-DD format',
    );
    expect(getBlueSquareStatsMock).not.toHaveBeenCalled();
  });

  it('returns 400 when comparison dates are invalid', async () => {
    const req = {
      query: {
        startDate: '2026-08-01',
        endDate: '2026-08-07',
        comparisonStartDate: 'bad-date',
        comparisonEndDate: '2026-07-31',
      },
    };

    await controller.getBlueSquareStats(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      'Please provide valid comparisonStartDate and comparisonEndDate in YYYY-MM-DD format',
    );
    expect(getBlueSquareStatsMock).not.toHaveBeenCalled();
  });

  it('returns blue square payload with blueSquareCount and chartData', async () => {
    getBlueSquareStatsMock.mockResolvedValue({
      missingHours: { count: 2 },
      missingSummary: { count: 0 },
      missingHoursAndSummary: { count: 0 },
      vacationTime: { count: 0 },
      other: { count: 0 },
      totalBlueSquares: { count: 2 },
    });

    const req = {
      query: {
        startDate: '2026-08-01',
        endDate: '2026-08-07',
      },
    };

    await controller.getBlueSquareStats(req, res);

    expect(getBlueSquareStatsMock).toHaveBeenCalledTimes(1);
    const [startDateArg, endDateArg, comparisonStartArg, comparisonEndArg] =
      getBlueSquareStatsMock.mock.calls[0];

    expect(startDateArg).toBeInstanceOf(Date);
    expect(endDateArg).toBeInstanceOf(Date);
    expect(startDateArg.toISOString()).toBe('2026-08-01T07:00:00.000Z');
    expect(endDateArg.toISOString()).toBe('2026-08-08T06:59:59.999Z');
    expect(comparisonStartArg).toBeUndefined();
    expect(comparisonEndArg).toBeUndefined();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      msg: {
        blueSquareCount: 2,
        missingHours: { count: 2 },
        missingSummary: { count: 0 },
        missingHoursAndSummary: { count: 0 },
        vacationTime: { count: 0 },
        other: { count: 0 },
        totalBlueSquares: { count: 2 },
        chartData: {
          missingHours: { count: 2 },
        },
      },
    });
  });

  it('passes comparison date boundaries to helper when provided', async () => {
    getBlueSquareStatsMock.mockResolvedValue({
      totalBlueSquares: { count: 0 },
    });

    const req = {
      query: {
        startDate: '2026-08-01',
        endDate: '2026-08-07',
        comparisonStartDate: '2026-07-25',
        comparisonEndDate: '2026-07-31',
      },
    };

    await controller.getBlueSquareStats(req, res);

    const [, , comparisonStartArg, comparisonEndArg] = getBlueSquareStatsMock.mock.calls[0];
    expect(comparisonStartArg).toBeInstanceOf(Date);
    expect(comparisonEndArg).toBeInstanceOf(Date);
    expect(comparisonStartArg.toISOString()).toBe('2026-07-25T07:00:00.000Z');
    expect(comparisonEndArg.toISOString()).toBe('2026-08-01T06:59:59.999Z');
  });
});
