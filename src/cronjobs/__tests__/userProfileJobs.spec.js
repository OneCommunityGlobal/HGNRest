/* =======================
   MOCKS (MUST COME FIRST)
   ======================= */

// Capture every CronJob constructed so a callback can be invoked directly.
// The jobs are scheduled weekly and daily, so this is the only practical way
// to exercise them.
const constructed = [];

jest.mock('cron', () => ({
  CronJob: jest.fn(function CronJob(cronTime, onTick, onComplete, start, timeZone) {
    constructed.push({ cronTime, onTick, timeZone });
    this.start = jest.fn();
  }),
}));

jest.mock('../../helpers/userHelper', () =>
  jest.fn(() => ({
    getProfileImagesFromWebsite: jest.fn().mockResolvedValue(undefined),
    assignBlueSquareForTimeNotMet: jest.fn().mockResolvedValue(undefined),
    applyMissedHourForCoreTeam: jest.fn().mockResolvedValue(undefined),
    emailWeeklySummariesForAllUsers: jest.fn().mockResolvedValue(undefined),
    deleteBlueSquareAfterYear: jest.fn().mockResolvedValue(undefined),
    deleteExpiredTokens: jest.fn().mockResolvedValue(undefined),
    awardNewBadges: jest.fn().mockResolvedValue(undefined),
    completeHoursAndMissedSummary: jest.fn().mockResolvedValue(undefined),
    weeklyAutoReplyEmailFunction: jest.fn().mockResolvedValue(undefined),
    reactivateUser: jest.fn().mockResolvedValue(undefined),
    finalizeUserEndDates: jest.fn().mockResolvedValue(undefined),
  })),
);

/* =======================
   IMPORTS AFTER MOCKS
   ======================= */

const userHelperFactory = require('../../helpers/userHelper');
const userProfileJobs = require('../userProfileJobs');

// 2026-09-13 is a Sunday. 18:00 UTC is 11:00 in Los Angeles, so the callback's
// own day() check passes wherever this test is run.
const A_SUNDAY = new Date('2026-09-13T18:00:00.000Z');

// The Sunday job is the first CronJob constructed in userProfileJobs.
const sundayCallback = () => constructed[0].onTick;

// userProfileJobs.js calls the helper factory once at module load, not on every
// userProfileJobs() call, so the helper is captured here rather than per test.
const helper = userHelperFactory.mock.results[0].value;

describe('userProfileJobs, Sunday callback', () => {
  beforeEach(() => {
    constructed.length = 0;
    // Reset call counts and any rejection set by a previous test, then put the
    // resolved default back. clearAllMocks would leave a mockRejectedValue in
    // place and leak it into the next test.
    Object.values(helper).forEach((fn) => fn.mockReset().mockResolvedValue(undefined));
    jest.useFakeTimers().setSystemTime(A_SUNDAY);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    userProfileJobs();
  });

  afterEach(() => {
    jest.useRealTimers();
    console.error.mockRestore();
  });

  test('awards badges when every earlier job succeeds', async () => {
    await sundayCallback()();

    expect(helper.awardNewBadges).toHaveBeenCalledTimes(1);
  });

  test('still awards badges when an earlier job throws', async () => {
    helper.assignBlueSquareForTimeNotMet.mockRejectedValue(new Error('blue square boom'));

    await sundayCallback()();

    expect(helper.awardNewBadges).toHaveBeenCalledTimes(1);
  });

  test('runs every remaining job when the first one throws', async () => {
    helper.getProfileImagesFromWebsite.mockRejectedValue(new Error('images boom'));

    await sundayCallback()();

    expect(helper.assignBlueSquareForTimeNotMet).toHaveBeenCalledTimes(1);
    expect(helper.applyMissedHourForCoreTeam).toHaveBeenCalledTimes(1);
    expect(helper.emailWeeklySummariesForAllUsers).toHaveBeenCalledTimes(1);
    expect(helper.deleteBlueSquareAfterYear).toHaveBeenCalledTimes(1);
    expect(helper.deleteExpiredTokens).toHaveBeenCalledTimes(1);
    expect(helper.awardNewBadges).toHaveBeenCalledTimes(1);
  });

  test('never rejects, so the rejection cannot go unhandled inside cron', async () => {
    helper.awardNewBadges.mockRejectedValue(new Error('badges boom'));

    await expect(sundayCallback()()).resolves.toBeUndefined();
  });

  test('logs the failure rather than swallowing it silently', async () => {
    helper.deleteExpiredTokens.mockRejectedValue(new Error('tokens boom'));

    await sundayCallback()();

    expect(console.error).toHaveBeenCalledWith(
      'Error during deleteExpiredTokens:',
      expect.any(Error),
    );
  });
});
