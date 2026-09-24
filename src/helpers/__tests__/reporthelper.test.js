const moment = require('moment-timezone');

jest.mock('../../models/userProfile', () => ({ aggregate: jest.fn() }));

const userProfile = require('../../models/userProfile');
const reporthelper = require('../reporthelper')();

const TZ = 'America/Los_Angeles';
const endOfDayPt = (s) => moment.tz(s, TZ).endOf('day').toDate();

describe('reporthelper.weeklySummaries final week handling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Tuesday, Sep 22 2026: Last Week is Sep 13-19.
    jest.setSystemTime(moment.tz('2026-09-22 12:00', TZ).toDate());
    userProfile.aggregate.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('matches active users and inactive, non-paused users who left in the requested weeks', async () => {
    userProfile.aggregate.mockResolvedValue([]);

    await reporthelper.weeklySummaries(1, 1);

    const [pipeline] = userProfile.aggregate.mock.calls[0];
    const { $or } = pipeline[0].$match;
    expect($or[0]).toEqual({ isActive: true });
    expect($or[1]).toMatchObject({ isActive: false, inactiveReason: { $ne: 'Paused' } });
    expect($or[1].endDate.$gte).toEqual(moment.tz('2026-09-13', TZ).startOf('day').toDate());
    expect($or[1].endDate.$lte).toEqual(moment.tz('2026-09-19', TZ).endOf('day').toDate());
  });

  it('gives a deactivated user the index of the week they left, even with no time logged', async () => {
    userProfile.aggregate.mockResolvedValue([
      { isActive: false, endDate: endOfDayPt('2026-09-16'), timeEntries: [] },
    ]);

    const [user] = await reporthelper.weeklySummaries(1, 1);

    expect(user.finalWeekIndex).toBe(1);
  });

  it('returns the same index whichever week is requested', async () => {
    const endDate = endOfDayPt('2026-09-16');
    userProfile.aggregate.mockImplementation(async () => [
      { isActive: false, endDate, timeEntries: [] },
    ]);

    const indexes = [];
    for (const week of [0, 1, 2, 3]) {
      // eslint-disable-next-line no-await-in-loop
      const [user] = await reporthelper.weeklySummaries(week, week);
      indexes.push(user.finalWeekIndex);
    }

    expect(indexes).toEqual([1, 1, 1, 1]);
  });

  it('does not give an active user with a scheduled end date a final week', async () => {
    userProfile.aggregate.mockResolvedValue([
      { isActive: true, endDate: endOfDayPt('2026-10-10'), timeEntries: [] },
    ]);

    const [user] = await reporthelper.weeklySummaries(0, 0);

    expect(user.finalWeekIndex).toBeNull();
  });
});
