const UserProfile = require('../models/userProfile');
const overviewReportHelper = require('./overviewReportHelper');

// The dates the controller builds: start and end of a day at -07:00
const dayStart = (day) => new Date(`${day}T00:00:00-07:00`);
const dayEnd = (day) => new Date(`${day}T23:59:00-07:00`);

// A fake active user who joined on the given day (at noon -07:00 unless a time is given).
// The day is also the user's id, so the expected lists are easy to read.
const joinedOn = (day, time = '12:00') => ({
  _id: day,
  isActive: true,
  createdDate: new Date(`${day}T${time}:00-07:00`),
});

// Pretend MongoDB filter: understands $or, $gte, $lte, $type and plain values
const matches = (user, filter) =>
  Object.entries(filter).every(([field, rule]) => {
    if (field === '$or') return rule.some((branch) => matches(user, branch));
    if (typeof rule !== 'object') return user[field] === rule;
    const value = user[field];
    return (
      (rule.$type === undefined || value instanceof Date) &&
      (rule.$gte === undefined || value >= rule.$gte) &&
      (rule.$lte === undefined || value <= rule.$lte)
    );
  });

// Pretend database: findOne(filter).sort(order).lean() and aggregate([{ $match }, { $project }])
const mockDatabase = (users) => {
  jest.spyOn(UserProfile, 'findOne').mockImplementation((filter) => ({
    sort: (order) => ({
      lean: async () => {
        const found = users
          .filter((user) => matches(user, filter))
          .sort((a, b) => (a.createdDate - b.createdDate) * order.createdDate);
        return found[0] || null;
      },
    }),
  }));
  // Only the $match stage matters here; the $project stage is not checked
  return jest
    .spyOn(UserProfile, 'aggregate')
    .mockImplementation(async (pipeline) =>
      users.filter((user) => matches(user, pipeline[0].$match)),
    );
};

// Ids of the users listed for the whole days startDay to endDay
const listFor = async (startDay, endDay) => {
  const { getAnniversaries } = overviewReportHelper();
  const result = await getAnniversaries(dayStart(startDay), dayEnd(endDay));
  return result['1Year'].users.map((user) => user._id);
};

describe('getAnniversaries', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('lists only active users with a full year whose anniversary is in the range', async () => {
    mockDatabase([
      joinedOn('2026-03-20'), // 6 months only (the reported bug)
      joinedOn('2026-09-22'), // joined inside the range, no full year
      joinedOn('2025-09-19'), // anniversary the day before the range
      joinedOn('2025-09-20'), // 1 year, first day of the range
      joinedOn('2025-09-26'), // 1 year, last day of the range
      joinedOn('2025-09-27'), // anniversary the day after the range
      joinedOn('2023-09-24'), // 3 years
      { ...joinedOn('2024-09-22'), isActive: false }, // inactive
    ]);
    const { getAnniversaries } = overviewReportHelper();

    const result = await getAnniversaries(dayStart('2026-09-20'), dayEnd('2026-09-26'));

    expect(result['6Months']).toEqual({ users: [] });
    expect(result['1Year'].users.map((user) => user._id)).toEqual([
      '2025-09-20',
      '2025-09-26',
      '2023-09-24',
    ]);
    expect(result['1Year'].comparisonPercentage).toBeUndefined();
  });

  test('counts the whole first and last day of the range', async () => {
    mockDatabase([
      joinedOn('2025-09-19', '23:59'), // the minute before the first day
      joinedOn('2025-09-20', '00:00'), // first minute of the first day
      joinedOn('2025-09-26', '23:58'), // late on the last day
    ]);

    expect(await listFor('2026-09-20', '2026-09-26')).toEqual(['2025-09-20', '2025-09-26']);
  });

  test('handles a range that crosses New Year', async () => {
    mockDatabase([
      joinedOn('2024-12-30'), // 1 year on 2025-12-30
      joinedOn('2025-01-02'), // 1 year on 2026-01-02
      joinedOn('2025-12-30'), // joined inside the range, no full year
      joinedOn('2023-01-01'), // 3 years on 2026-01-01
      joinedOn('2025-01-04'), // anniversary after the range
    ]);

    expect(await listFor('2025-12-28', '2026-01-03')).toEqual([
      '2024-12-30',
      '2025-01-02',
      '2023-01-01',
    ]);
  });

  // Feb 29 joiners: Feb 28 in years without a Feb 29, Feb 29 in leap years
  test.each([
    ['2027-02-28', ['2024-02-28', '2024-02-29']], // 2027 has no Feb 29
    ['2027-03-01', ['2024-03-01']],
    ['2028-02-28', ['2024-02-28', '2027-02-28']], // 2028 has a Feb 29
    ['2028-02-29', ['2024-02-29']],
    ['2028-03-01', ['2024-03-01', '2027-03-01']],
  ])('applies the Feb 29 rule on %s', async (day, expected) => {
    const days = ['2024-02-28', '2024-02-29', '2024-03-01', '2027-02-28', '2027-03-01'];
    mockDatabase(days.map((joinDay) => joinedOn(joinDay)));

    expect(await listFor(day, day)).toEqual(expected);
  });

  test('uses the -07:00 day for people who joined late in the evening of Feb 28', async () => {
    mockDatabase([
      joinedOn('2024-02-28', '20:00'), // stored as Feb 29 in UTC
      joinedOn('2025-02-28', '20:00'), // stored as Mar 1 in UTC
    ]);

    expect(await listFor('2027-02-27', '2027-02-27')).toEqual([]);
    expect(await listFor('2028-02-28', '2028-02-28')).toEqual(['2024-02-28', '2025-02-28']);
    expect(await listFor('2028-02-29', '2028-02-29')).toEqual([]);
  });

  test('lists everyone with a full year when the range is longer than a year', async () => {
    mockDatabase([
      joinedOn('2019-03-15'),
      joinedOn('2023-07-04'),
      joinedOn('2024-12-31'), // 1 year on the last day
      joinedOn('2025-01-01'), // first anniversary is after the range
    ]);

    expect(await listFor('2024-06-01', '2025-12-31')).toEqual([
      '2019-03-15',
      '2023-07-04',
      '2024-12-31',
    ]);
  });

  test('skips profiles without a valid createdDate', async () => {
    mockDatabase([{ _id: 'no date', isActive: true, createdDate: null }, joinedOn('2025-09-22')]);

    expect(await listFor('2026-09-20', '2026-09-26')).toEqual(['2025-09-22']);
  });

  test('does not query when nobody can have a full year yet', async () => {
    const aggregateSpy = mockDatabase([joinedOn('2026-01-15')]);

    expect(await listFor('2026-09-20', '2026-09-26')).toEqual([]);
    expect(aggregateSpy).not.toHaveBeenCalled();
  });

  test('returns empty lists when there are no active users', async () => {
    const aggregateSpy = mockDatabase([{ ...joinedOn('2020-09-22'), isActive: false }]);
    const { getAnniversaries } = overviewReportHelper();

    const result = await getAnniversaries(dayStart('2026-09-20'), dayEnd('2026-09-26'));

    expect(result).toEqual({ '6Months': { users: [] }, '1Year': { users: [] } });
    expect(aggregateSpy).not.toHaveBeenCalled();
  });

  test('uses the same rule for the comparison period', async () => {
    const aggregateSpy = mockDatabase([
      joinedOn('2025-09-22'), // selected week
      joinedOn('2024-09-21'), // selected week
      joinedOn('2025-09-15'), // comparison week
    ]);
    const { getAnniversaries } = overviewReportHelper();

    const result = await getAnniversaries(
      dayStart('2026-09-20'),
      dayEnd('2026-09-26'),
      // The controller sends comparison dates as UTC midnight
      new Date('2026-09-13'),
      new Date('2026-09-19'),
    );

    expect(result['1Year'].users.map((user) => user._id)).toEqual(['2025-09-22', '2024-09-21']);
    expect(result['1Year'].comparisonPercentage).toBe(1); // (2 - 1) / 1 = +100%
    expect(result['6Months']).toEqual({ users: [] });
    expect(aggregateSpy).toHaveBeenCalledTimes(2);
  });
});
