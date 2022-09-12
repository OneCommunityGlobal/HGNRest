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
      await userhelper.deActivateUser();
    },
    null,
    false,
    'America/Los_Angeles',
  );

  allUserProfileJobs.start();
/* For Test
  const test1 = new CronJob(
    '42 * * * *', // At minute 42. You can change the minute whenever your want to test 
    async () => {
      await userhelper.test();
    },
    null,
    false,
    'America/Los_Angeles',
  );
  test1.start();
*/
};
module.exports = userProfileJobs;
