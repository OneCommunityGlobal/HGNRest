const { CronJob } = require('cron');
const moment = require('moment-timezone');

const userHelper = require('../helpers/userHelper')();


const userProfileJobs = () => {
  const allUserProfileJobs = new CronJob(
    '1 0 * * *', // Every day, 1 minute past midnight (PST).
    async () => {
      const SUNDAY = 0;
      if (moment().tz('America/Los_Angeles').day() === SUNDAY) {
        await userHelper.assignBlueSquareforTimeNotMet();
        await userHelper.emailWeeklySummariesForAllUsers();
        await userHelper.deleteBlueSquareAfterYear();
        await userHelper.awardNewBadges();
      }
      await userHelper.reActivateUser();
      await userHelper.deActivateUser();
    },
    null,
    false,
    'America/Los_Angeles',
  );

  allUserProfileJobs.start();
};
module.exports = userProfileJobs;
