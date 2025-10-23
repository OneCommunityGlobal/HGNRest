const { CronJob } = require('cron');
const moment = require('moment-timezone');

const userhelper = require('../helpers/userHelper')();

const userProfileJobs = () => {
  const allUserProfileJobs = new CronJob(
    // '* * * * *', // Comment out for testing. Run Every minute.
    '1 0 * * 0', // Every Sunday, 1 minute past midnight.

    async () => {
      const SUNDAY = 0; // will change back to 0 after fix
      if (moment().tz('America/Los_Angeles').day() === SUNDAY) {
        await userhelper.getProfileImagesFromWebsite();
        await userhelper.assignBlueSquareForTimeNotMet();
        await userhelper.applyMissedHourForCoreTeam();
        await userhelper.emailWeeklySummariesForAllUsers();
        await userhelper.deleteBlueSquareAfterYear();
        await userhelper.deleteExpiredTokens();
      }
      await userhelper.awardNewBadges();
    },
    null,
    false,
    'America/Los_Angeles',
  );

  const summaryNotSubmittedJobs = new CronJob(
    // '* * * * *',
    // '0 4 * * 0', // Every Sunday at 4AM
    // '7 2 * * 2', // Every Tuesday at 7 minutes past 2AM, if i run server before it
    // '50 20 * * *', // Every day at 50 minutes past 8PM, if i run server before it
    '30 15 * * *',
    // '* * * * *'
    // first * is minutes past midnight
    // second * is hours past midnight
    // third * is day of month (1 - 31)
    // fourth * is month (1 - 12)
    // last * is the day, 0 for Sunday, up to 6 for Saturday
    async () => {
      // const SUNDAY = 0;
      // if (moment().tz('America/Los_Angeles').day() === SUNDAY) {
      //   await userhelper.completeHoursAndMissedSummary();
      // }
      await userhelper.completeHoursAndMissedSummary();
      // await userhelper.inCompleteHoursEmailFunction();
      // await userhelper.weeklyBlueSquareReminderFunction();
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
  summaryNotSubmittedJobs.start();
};
module.exports = userProfileJobs;
