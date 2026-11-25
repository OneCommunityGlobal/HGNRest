// Every CronJob built by userProfileJobs is captured so the daily callback can be run directly.
const constructed = [];

jest.mock('cron', () => ({
  CronJob: jest.fn(function CronJob(cronTime, onTick) {
    constructed.push({ cronTime, onTick });
    this.start = jest.fn();
  }),
}));

// The real helper only has reActivateUser (capital A). The mock has the same names,
// so calling a name the helper does not have fails here the same way it fails in production.
jest.mock('../../helpers/userHelper', () =>
  jest.fn(() => ({
    reActivateUser: jest.fn().mockResolvedValue(undefined),
    finalizeUserEndDates: jest.fn().mockResolvedValue(undefined),
  })),
);

jest.mock('../../controllers/badgeController', () => jest.fn(() => ({})));
jest.mock('../../models/badge', () => ({}));
jest.mock('../../startup/logger', () => ({ logInfo: jest.fn(), logException: jest.fn() }));

const userHelperFactory = require('../../helpers/userHelper');
const logger = require('../../startup/logger');
const userProfileJobs = require('../userProfileJobs');

const helper = userHelperFactory.mock.results[0].value;
const DAILY = '1 0 * * *';
const dailyCallback = () => constructed.find((job) => job.cronTime === DAILY).onTick;

describe('userProfileJobs, daily reactivation callback', () => {
  beforeEach(() => {
    constructed.length = 0;
    Object.values(helper).forEach((fn) => fn.mockReset().mockResolvedValue(undefined));
    logger.logException.mockClear();
    userProfileJobs();
  });

  test('reactivates paused users and then finalizes end dates', async () => {
    await dailyCallback()();

    expect(helper.reActivateUser).toHaveBeenCalledTimes(1);
    expect(helper.finalizeUserEndDates).toHaveBeenCalledTimes(1);
    expect(logger.logException).not.toHaveBeenCalled();
  });

  test('still finalizes end dates when reactivation throws', async () => {
    helper.reActivateUser.mockRejectedValue(new Error('reactivate boom'));

    await dailyCallback()();

    expect(helper.finalizeUserEndDates).toHaveBeenCalledTimes(1);
    expect(logger.logException).toHaveBeenCalledWith(
      expect.any(Error),
      'Daily cron: reActivateUser',
    );
  });

  test('never rejects, so a failure cannot go unhandled inside cron', async () => {
    helper.reActivateUser.mockRejectedValue(new Error('reactivate boom'));
    helper.finalizeUserEndDates.mockRejectedValue(new Error('finalize boom'));

    await expect(dailyCallback()()).resolves.toBeUndefined();
    expect(logger.logException).toHaveBeenCalledTimes(2);
  });
});
