jest.mock('../../models/team', () => ({}));

jest.mock('../../models/userProfile', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../../models/timeentry', () => ({}));
jest.mock('../../models/task', () => ({}));
jest.mock('../../models/project', () => ({}));

const UserProfile = require('../../models/userProfile');
const overviewReportHelperFactory = require('../overviewReportHelper');

describe('overviewReportHelper.getBlueSquareStats', () => {
  const helper = overviewReportHelperFactory();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns normalized reason buckets and total count without comparison', async () => {
    UserProfile.aggregate
      .mockResolvedValueOnce([{ _id: 'missingHours', count: 3 }])
      .mockResolvedValueOnce([{ totalBlueSquares: 3 }]);

    const result = await helper.getBlueSquareStats(
      new Date('2026-08-01T07:00:00.000Z'),
      new Date('2026-08-08T06:59:59.999Z'),
    );

    expect(UserProfile.aggregate).toHaveBeenCalledTimes(2);
    expect(UserProfile.aggregate.mock.calls[1][0]).toEqual(
      expect.arrayContaining([{ $count: 'totalBlueSquares' }]),
    );

    expect(result).toEqual({
      missingHours: { count: 3 },
      missingSummary: { count: 0 },
      missingHoursAndSummary: { count: 0 },
      vacationTime: { count: 0 },
      other: { count: 0 },
      totalBlueSquares: { count: 3 },
    });
  });

  it('adds comparison percentage when comparison range is provided', async () => {
    UserProfile.aggregate
      .mockResolvedValueOnce([{ _id: 'vacationTime', count: 10 }])
      .mockResolvedValueOnce([{ totalBlueSquares: 10 }])
      .mockResolvedValueOnce([{ totalBlueSquares: 5 }]);

    const result = await helper.getBlueSquareStats(
      new Date('2026-08-01T07:00:00.000Z'),
      new Date('2026-08-08T06:59:59.999Z'),
      new Date('2026-07-25T07:00:00.000Z'),
      new Date('2026-08-01T06:59:59.999Z'),
    );

    expect(UserProfile.aggregate).toHaveBeenCalledTimes(3);
    expect(result.totalBlueSquares).toEqual({
      count: 10,
      comparisonPercentage: 1,
    });
    expect(result.vacationTime).toEqual({ count: 10 });
  });
});
