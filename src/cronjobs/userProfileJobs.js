const { CronJob } = require('cron');
const moment = require('moment-timezone');

const userhelper = require('../helpers/userhelper')();

const userProfileJobs = () => {
  const allUserProfileJobs = new CronJob(
    '1 0 * * *', // Every day, 1 minute past midnight (PST).
    async () => {
      const SUNDAY = 0;
      if (moment().tz('America/Los_Angeles').day() === SUNDAY) {
        await userhelper.assignBlueSquareforTimeNotMet();
        await userhelper.emailWeeklySummariesForAllUsers();
        await userhelper.deleteBlueSquareAfterYear();
        await userhelper.awardNewBadges();
      }
      await userhelper.reActivateUser();
    },
    null,
    false,
    'America/Los_Angeles',
  );

  allUserProfileJobs.start();
};

module.exports = userProfileJobs;
