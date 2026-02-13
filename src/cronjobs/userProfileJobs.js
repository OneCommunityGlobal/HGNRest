const { CronJob } = require('cron');
const moment = require('moment-timezone');
const userhelper = require('../helpers/userHelper')();
const badgeController = require('../controllers/badgeController');

const userProfileJobs = () => {
  /* eslint-disable no-unused-vars */
  // 1: Minute (0-59)
  // 2: Hour (0-23)
  // 3: Day of Month (1-31)
  // 4: Month (0-11)
  // 5: Day of Week (0-6) (0 is Sunday)
  const allUserProfileJobs = new CronJob(
    // '* * * * *', // Comment out for testing. Run Every minute.
    '0 0 * * 0', // Every Sunday, 12 AM.
    async () => {
      const SUNDAY = 0;
      if (moment().tz('America/Los_Angeles').day() === SUNDAY) {
        await userhelper.getProfileImagesFromWebsite();
        await userhelper.assignBlueSquareForTimeNotMet();
        await userhelper.applyMissedHourForCoreTeam();
        await userhelper.emailWeeklySummariesForAllUsers();
        await userhelper.deleteBlueSquareAfterYear();
        await userhelper.deleteExpiredTokens();

        // New badge-related jobs
        await badgeController.updateBadgesWithUsers();
        await badgeController.updateBadgeUsers();
      }
      await userhelper.awardNewBadges();
    },
    null,
    false,
    'America/Los_Angeles',
  );

  // 1: Minute (0-59)
  // 2: Hour (0-23)
  // 3: Day of Month (1-31)
  // 4: Month (0-11)
  // 5: Day of Week (0-6) (0 is Sunday)
  const summaryNotSubmittedJobs = new CronJob(
    '0 4 * * 0', // Every Sunday at 4AM
    async () => {
      try {
        console.log(
          'Starting summaryNotSubmittedJobs at:',
          moment().tz('America/Los_Angeles').format(),
        );
        await userhelper.completeHoursAndMissedSummary();
        await userhelper.inCompleteHoursEmailFunction();
        await userhelper.weeklyBlueSquareReminderFunction();
      } catch (error) {
        console.error('Error during summaryNotSubmittedJobs:', error);
      }
    },
    null,
    false,
    'America/Los_Angeles',
  );

  // Job to run every day, 1 minute past midnight to deactivate the user
  // 1: Minute (0-59)
  // 2: Hour (0-23)
  // 3: Day of Month (1-31)
  // 4: Month (0-11)
  // 5: Day of Week (0-6) (0 is Sunday)
  const dailyUserDeactivateJobs = new CronJob(
    // '* * * * *', // Comment out for testing. Run Every minute.
    '1 0 * * *', // Every day, 1 minute past midnight
    async () => {
      await userhelper.reactivateUser();
      await userhelper.finalizeUserEndDates();
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
