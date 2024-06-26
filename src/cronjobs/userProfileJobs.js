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
        await userhelper.assignBlueSquareForTimeNotMet();
        await userhelper.applyMissedHourForCoreTeam();
        await userhelper.emailWeeklySummariesForAllUsers();
        await userhelper.deleteBlueSquareAfterYear();
        await userhelper.deleteExpiredTokens();
      }
      await userhelper.awardNewBadges();
      await userhelper.reActivateUser();
      await userhelper.deActivateUser();
    },
    null,
    false,
    'America/Los_Angeles',
  );

  allUserProfileJobs.start();
};
module.exports = userProfileJobs;
