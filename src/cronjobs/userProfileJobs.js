const { CronJob } = require('cron');
const moment = require('moment-timezone');

const userhelper = require('../helpers/userHelper')();

const userProfileJobs = () => {
  const allUserProfileJobs = new CronJob(
    // '* * * * *', // Comment out for testing. Run Every minute.
    // '1 0 * * 0', // Every Sunday, 1 minute past midnight.
    '1 0 * * *', // Every day, 1 minute past midnight

    async () => {
      // console.log('Starting weekly user profile jobs...');
      const SUNDAY = 0; // will change back to 0 after fix
      if (moment().tz('America/Los_Angeles').day() === SUNDAY) {
        // console.log('Running Sunday-specific jobs...');
        await userhelper.getProfileImagesFromWebsite();
        // console.log('Completed: Profile images update');
        await userhelper.assignBlueSquareForTimeNotMet();
        // console.log('Completed: Blue square assignment');
        await userhelper.applyMissedHourForCoreTeam();
        // console.log('Completed: Missed hour application');
        await userhelper.emailWeeklySummariesForAllUsers();
        //  console.log('Completed: Weekly summary emails');
        await userhelper.deleteBlueSquareAfterYear();
        //  console.log('Completed: Blue square cleanup');
        await userhelper.deleteExpiredTokens();
      //  console.log('Completed: Token cleanup');
      }
      await userhelper.awardNewBadges();
      // console.log('Completed: Badge awards');
      // console.log('Weekly user profile jobs completed successfully');
    },
    null,
    false,
    'America/Los_Angeles',
  );

  // Job to run every day, 1 minute past midnight to deactivate the user
  const dailyUserDeactivateJobs = new CronJob(
    // '* * * * *', // Comment out for testing. Run Every minute.
    // Changed it to run every day, 1 minute past midnight
    '1 0 * * *', // Every day, 1 minute past midnight
    async () => {
      // console.log('Starting daily user activation jobs...');
      await userhelper.deActivateUser();
      // console.log('Completed: User deactivation');
      await userhelper.reActivateUser();
      // console.log('Completed: User reactivation');
      // console.log('Daily user activation jobs completed successfully');
    },
    null,
    false,
    'America/Los_Angeles',
  );
  allUserProfileJobs.start();
  dailyUserDeactivateJobs.start();
};
module.exports = userProfileJobs;
