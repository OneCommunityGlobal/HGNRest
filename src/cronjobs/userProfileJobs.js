const { CronJob } = require('cron');
const moment = require('moment-timezone');

const userhelper = require('../helpers/userHelper')();

const userProfileJobs = () => {
  const allUserProfileJobs = new CronJob(
    '* * * * *', // Comment out for testing. Run Every minute.
    // '1 0 * * 0', // Every Sunday, 1 minute past midnight.

    async () => {
      const SUNDAY = 0; // will change back to 0 after fix
      // Temporarily bypass Sunday check for testing
      if (true || moment().tz('America/Los_Angeles').day() === SUNDAY) {
        console.log('[CRON DEBUG] Testing ONLY email function...');
        // Skip other jobs that are causing issues
        // await userhelper.getProfileImagesFromWebsite();
        // await userhelper.assignBlueSquareForTimeNotMet();
        // await userhelper.applyMissedHourForCoreTeam();
        console.log('[CRON DEBUG] Starting emailWeeklySummariesForAllUsers...');
        await userhelper.emailWeeklySummariesForAllUsers();
        console.log('[CRON DEBUG] Completed emailWeeklySummariesForAllUsers');
        // await userhelper.deleteBlueSquareAfterYear();
        // await userhelper.deleteExpiredTokens();
        console.log('[CRON DEBUG] Email test completed');
      }
      await userhelper.awardNewBadges();
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
