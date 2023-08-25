const { CronJob } = require('cron');
const moment = require('moment-timezone');

const userhelper = require('../helpers/userHelper')();

const userProfileJobs = () => {
  const allUserProfileJobs = new CronJob(
    '1 0 * * *', // Every day, 1 minute past midnight (PST).
    async () => {
      const SUNDAY = 0;
      if (moment().tz('America/Los_Angeles').day() === SUNDAY) {
        await userhelper.assignBlueSquareForTimeNotMet();
        await userhelper.applyMissedHourForCoreTeam();
        await userhelper.emailWeeklySummariesForAllUsers();
        await userhelper.executeSummaryGroupHelper();
        await userhelper.deleteBlueSquareAfterYear();
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
