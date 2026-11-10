/**
 * Tests for the daily paused-user reactivation job.
 *
 * The bug this covers: the cron called `userhelper.reactivateUser()` while the
 * helper exported `reActivateUser`, so it threw a TypeError every night, nobody
 * was ever reactivated, and the unhandled rejection also stopped
 * `finalizeUserEndDates()` on the following line from running.
 */

jest.mock('../../models/userProfile', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
  aggregate: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../models/badge', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../../models/team', () => ({ aggregate: jest.fn(), find: jest.fn() }));
jest.mock('../dashboardhelper', () => jest.fn(() => ({ laborthisweek: jest.fn() })));
jest.mock('../../utilities/emailSender', () => jest.fn());
jest.mock('../../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

const moment = require('moment-timezone');
const userProfile = require('../../models/userProfile');
const emailSender = require('../../utilities/emailSender');
const logger = require('../../startup/logger');
const userHelperFactory = require('../userHelper');
const { COMPANY_TZ } = require('../../constants/company');

const helper = userHelperFactory();
const { reactivateUser } = helper;

const USER_ID = '637af0c0fb9bbc1e308cff01';

/** A paused user, due back on the given date. */
const pausedUser = (reactivationDate, overrides = {}) => ({
  _id: USER_ID,
  firstName: 'Ann',
  lastName: 'Adams',
  email: 'ann@example.com',
  deactivatedAt: new Date('2026-08-01T12:00:00Z'),
  reactivationDate,
  ...overrides,
});

const setUpdate = () => userProfile.findOneAndUpdate.mock.calls[0][1].$set;
const unsetUpdate = () => userProfile.findOneAndUpdate.mock.calls[0][1].$unset;

describe('reactivateUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userProfile.find.mockResolvedValue([]);
    userProfile.findOneAndUpdate.mockResolvedValue({});
    // getEmailRecipientsForStatusChange reads teams off the profile.
    userProfile.findById.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const freezeAt = (iso) => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date(iso));
  };

  it('is exported under the name the cron job actually calls', () => {
    // The whole bug in one assertion. The helper used to export
    // `reActivateUser` while userProfileJobs.js called `reactivateUser`.
    expect(typeof helper.reactivateUser).toBe('function');
    expect(helper.reActivateUser).toBeUndefined();
  });

  it('only looks at inactive users who have a reactivation date', async () => {
    await reactivateUser();

    const [query] = userProfile.find.mock.calls[0];
    expect(query.isActive).toBe(false);
    // Not `$exists`, which also matches an explicit null.
    expect(query.reactivationDate).toEqual({ $ne: null });
  });

  it('reactivates somebody whose date is today', async () => {
    // Stored as the start of the day in company time; the job runs 00:01.
    const today = moment.tz('2026-08-20', COMPANY_TZ).startOf('day').toDate();
    freezeAt('2026-08-20T07:01:00Z'); // 00:01 Pacific on the 20th
    userProfile.find.mockResolvedValue([pausedUser(today)]);

    await reactivateUser();

    expect(userProfile.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(setUpdate().isActive).toBe(true);
  });

  it('reactivates somebody whose date has already passed', async () => {
    freezeAt('2026-08-25T07:01:00Z');
    userProfile.find.mockResolvedValue([
      pausedUser(moment.tz('2026-08-20', COMPANY_TZ).startOf('day').toDate()),
    ]);

    await reactivateUser();

    expect(userProfile.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('leaves somebody whose date is still in the future alone', async () => {
    freezeAt('2026-08-20T07:01:00Z');
    userProfile.find.mockResolvedValue([
      pausedUser(moment.tz('2026-08-25', COMPANY_TZ).startOf('day').toDate()),
    ]);

    await reactivateUser();

    expect(userProfile.findOneAndUpdate).not.toHaveBeenCalled();
    expect(emailSender).not.toHaveBeenCalled();
  });

  it('clears every field the manual Resume button clears', async () => {
    // These must agree. In particular a leftover reactivationDate would
    // permanently exclude the user from finalizeUserEndDates, which skips
    // anyone who still looks paused.
    freezeAt('2026-08-20T07:01:00Z');
    userProfile.find.mockResolvedValue([
      pausedUser(moment.tz('2026-08-20', COMPANY_TZ).startOf('day').toDate()),
    ]);

    await reactivateUser();

    expect(setUpdate()).toMatchObject({
      isActive: true,
      deactivatedAt: null,
      reactivationDate: null,
      endDate: null,
      isSet: false,
      finalEmailThreeWeeksSent: false,
    });
    expect(unsetUpdate()).toHaveProperty('inactiveReason');
  });

  it('sends the resumed email with the date they were paused on', async () => {
    freezeAt('2026-08-20T07:01:00Z');
    const pausedAt = new Date('2026-08-01T12:00:00Z');
    userProfile.find.mockResolvedValue([
      pausedUser(moment.tz('2026-08-20', COMPANY_TZ).startOf('day').toDate(), {
        deactivatedAt: pausedAt,
      }),
    ]);

    await reactivateUser();

    expect(emailSender).toHaveBeenCalledTimes(1);
    const body = emailSender.mock.calls[0][2];
    // The old implementation read endDate *after* wiping it, so the date in
    // this email was always wrong.
    expect(body).toContain(moment(pausedAt).tz(COMPANY_TZ).format('M-D-YYYY'));
    expect(body).toContain('RESUMED');
  });

  it('skips a record with an unreadable reactivation date instead of activating it', async () => {
    freezeAt('2026-08-20T07:01:00Z');
    userProfile.find.mockResolvedValue([pausedUser('not a date')]);

    await reactivateUser();

    expect(userProfile.findOneAndUpdate).not.toHaveBeenCalled();
    expect(logger.logInfo).toHaveBeenCalledWith(expect.stringContaining('unreadable'));
  });

  it('keeps going when one user fails, so one bad record cannot block the rest', async () => {
    freezeAt('2026-08-20T07:01:00Z');
    const due = moment.tz('2026-08-20', COMPANY_TZ).startOf('day').toDate();
    userProfile.find.mockResolvedValue([
      pausedUser(due, { _id: 'first' }),
      pausedUser(due, { _id: 'second' }),
    ]);
    userProfile.findOneAndUpdate
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce({});

    await reactivateUser();

    expect(userProfile.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(logger.logException).toHaveBeenCalled();
  });

  it('only updates a user who is still in the state the job read', async () => {
    freezeAt('2026-08-20T07:01:00Z');
    const due = moment.tz('2026-08-20', COMPANY_TZ).startOf('day').toDate();
    userProfile.find.mockResolvedValue([pausedUser(due)]);

    await reactivateUser();

    const [filter] = userProfile.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: USER_ID, isActive: false, reactivationDate: due });
  });

  it('does not overwrite or email a user whose status changed after the job read it', async () => {
    // An admin resumed, re-paused or separated the user between the scan and
    // the write, so the conditional update matches nothing.
    freezeAt('2026-08-20T07:01:00Z');
    const due = moment.tz('2026-08-20', COMPANY_TZ).startOf('day').toDate();
    userProfile.find.mockResolvedValue([
      pausedUser(due, { _id: 'changed' }),
      pausedUser(due, { _id: 'unchanged' }),
    ]);
    userProfile.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValueOnce({});

    await reactivateUser();

    expect(userProfile.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(logger.logInfo).toHaveBeenCalledWith(
      expect.stringContaining('skipping user changed, status changed'),
    );
    // Only the user who was actually reactivated gets the resumed email.
    expect(emailSender).toHaveBeenCalledTimes(1);
  });

  it('reports a failure to load users rather than throwing at the cron', async () => {
    // The cron now isolates each call, but this must not throw regardless.
    userProfile.find.mockRejectedValue(new Error('db down'));

    await expect(reactivateUser()).resolves.toBeUndefined();
    expect(logger.logException).toHaveBeenCalled();
    expect(userProfile.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does nothing quietly when nobody is due', async () => {
    userProfile.find.mockResolvedValue([]);

    await reactivateUser();

    expect(userProfile.findOneAndUpdate).not.toHaveBeenCalled();
    expect(emailSender).not.toHaveBeenCalled();
    expect(logger.logException).not.toHaveBeenCalled();
  });
});
