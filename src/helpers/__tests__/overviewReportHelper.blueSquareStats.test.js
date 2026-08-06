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

  it('fills missing reason buckets and handles missing total aggregate row', async () => {
    UserProfile.aggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await helper.getBlueSquareStats(
      new Date('2026-08-01T07:00:00.000Z'),
      new Date('2026-08-08T06:59:59.999Z'),
    );

    expect(result).toEqual({
      missingHours: { count: 0 },
      missingSummary: { count: 0 },
      missingHoursAndSummary: { count: 0 },
      vacationTime: { count: 0 },
      other: { count: 0 },
      totalBlueSquares: { count: 0 },
    });
  });

  it('builds LA-timezone effective-date and reason classification conditions in aggregation pipeline', async () => {
    UserProfile.aggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await helper.getBlueSquareStats(
      new Date('2026-08-01T07:00:00.000Z'),
      new Date('2026-08-08T06:59:59.999Z'),
    );

    const dataPipeline = UserProfile.aggregate.mock.calls[0][0];
    const matchStage = dataPipeline.find((stage) => stage.$match);
    expect(matchStage).toBeDefined();
    expect(matchStage.$match['infringements.effectiveDate']).toEqual(
      expect.objectContaining({
        $ne: null,
        $gte: new Date('2026-08-01T07:00:00.000Z'),
        $lte: new Date('2026-08-08T06:59:59.999Z'),
      }),
    );

    const effectiveDateStage = dataPipeline.find(
      (stage) => stage.$addFields && stage.$addFields['infringements.effectiveDate'],
    );
    expect(effectiveDateStage).toBeDefined();
    const effectiveDateCond = effectiveDateStage.$addFields['infringements.effectiveDate'].$cond;
    expect(effectiveDateCond[1].$dateFromString.timezone).toBe('America/Los_Angeles');

    const reasonStage = dataPipeline.find(
      (stage) => stage.$addFields && stage.$addFields['infringements.reason'],
    );
    expect(reasonStage).toBeDefined();
    const reasonCond = reasonStage.$addFields['infringements.reason'].$cond;
    expect(reasonCond[1]).toBe('vacationTime');
  });
});

describe('overviewReportHelper.getTotalBadgesAwardedCount', () => {
  const helper = overviewReportHelperFactory();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns count and parsed badges in non-comparison mode', async () => {
    UserProfile.aggregate.mockResolvedValueOnce([
      {
        badgeId: 'badge-1',
        earnedDate: 'Jan-01-26',
        earnedDateParsed: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        badgeId: 'badge-2',
        earnedDate: 'Jan-02-26',
        earnedDateParsed: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    const result = await helper.getTotalBadgesAwardedCount('2026-01-01', '2026-01-07');

    expect(UserProfile.aggregate).toHaveBeenCalledTimes(1);
    expect(UserProfile.aggregate.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ $unwind: '$badgeCollection' }),
        expect.objectContaining({
          $match: expect.objectContaining({
            earnedDateParsed: expect.any(Object),
          }),
        }),
      ]),
    );

    expect(result).toEqual({
      count: 2,
      badges: [
        {
          badgeId: 'badge-1',
          earnedDate: 'Jan-01-26',
          earnedDateParsed: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          badgeId: 'badge-2',
          earnedDate: 'Jan-02-26',
          earnedDateParsed: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    });
  });

  it('returns comparison payload in comparison mode', async () => {
    UserProfile.aggregate.mockResolvedValueOnce([
      {
        current: [{ badgeCollection: 8 }],
        comparison: [{ badgeCollection: 4 }],
      },
    ]);

    const result = await helper.getTotalBadgesAwardedCount(
      '2026-01-01',
      '2026-01-07',
      '2025-12-25',
      '2025-12-31',
    );

    expect(UserProfile.aggregate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      current: 8,
      comparison: 4,
      percentage: 1,
    });
  });

  it('constructs badge date parsing fallback conditions for non-ISO formats', async () => {
    UserProfile.aggregate.mockResolvedValueOnce([]);

    await helper.getTotalBadgesAwardedCount('2026-01-01', '2026-01-07');

    const pipeline = UserProfile.aggregate.mock.calls[0][0];
    const fixedDateStage = pipeline.find(
      (stage) => stage.$addFields && stage.$addFields.fixedDateString,
    );
    expect(fixedDateStage).toBeDefined();

    const parseStage = pipeline.find(
      (stage) => stage.$addFields && stage.$addFields.earnedDateParsed,
    );
    expect(parseStage).toBeDefined();

    const cond = parseStage.$addFields.earnedDateParsed.$cond;
    expect(cond[0].$regexMatch.regex.toString()).toContain('T\\d{2}:');
    expect(cond[2].$cond[0].$regexMatch.regex.toString()).toContain('^[A-Z][a-z]{2}-');
  });
});
