const { CronJob } = require('cron');
const moment = require('moment-timezone');
const userhelper = require('../helpers/userHelper')();

const TEST_EMAILS = ['sundarmachani@gmail.com', 'one.community@me.com', 'wadhwanidiya23@gmail.com'];

const userProfileJobs = () => {
  const allUserProfileJobs = new CronJob(
    '40 16 * * *', // 6:40 PM CST == 4:40 PM PST (America/Los_Angeles)
    async () => {
      console.log('[Scheduler] Triggered at', moment().tz('America/Los_Angeles').format());

      await userhelper.getProfileImagesFromWebsite(TEST_EMAILS);
      await userhelper.assignBlueSquareForTimeNotMet(TEST_EMAILS);
      await userhelper.applyMissedHourForCoreTeam(TEST_EMAILS);
      await userhelper.emailWeeklySummariesForAllUsers(1, TEST_EMAILS);

      // await userhelper.deleteBlueSquareAfterYear();
      // await userhelper.deleteExpiredTokens();

      await userhelper.awardNewBadges(TEST_EMAILS);
    },
    null,
    false,
    'America/Los_Angeles',
  );

  // Job to run every day, 1 minute past midnight to deactivate the user
  const dailyUserDeactivateJobs = new CronJob(
    // '* * * * *', // Comment out for testing. Run Every minute.
    '1 0 * * *', // Every day, 1 minute past midnight
    async () => {
      await userhelper.deActivateUser();
      await userhelper.reActivateUser();
    },
    null,
    false,
    'America/Los_Angeles',
  );
  allUserProfileJobs.start();
  dailyUserDeactivateJobs.start();
};
module.exports = userProfileJobs;
