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
      await userhelper.reActivateUser();
    },
    null,
    false,
    'America/Los_Angeles',
  );

  const summaryNotSubmittedJobs=new CronJob(
      // '* * * * *',
      '0 4 * * 0', // Every Sunday at 4AM
      async () => {
        const SUNDAY = 0;
        if (moment().tz('America/Los_Angeles').day() === SUNDAY) {
          await userhelper.completeHoursAndMissedSummary();
        }
      },
      null,
      false,
      'America/Los_Angeles', 
  );
  // Job to run every day, 1 minute past midnight to deactivate the user
  const dailyUserDeactivateJobs = new CronJob(
    '1 0 * * *', // Every day, 1 minute past midnight
    async () => {
      await userhelper.deActivateUser();
    },
    null,
    false,
    'America/Los_Angeles',
  );
  
  allUserProfileJobs.start();
  summaryNotSubmittedJobs.start();
  dailyUserDeactivateJobs.start();
  
};

module.exports = userProfileJobs;
