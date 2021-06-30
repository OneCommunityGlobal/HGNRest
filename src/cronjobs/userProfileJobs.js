import { CronJob } from 'cron';

const userhelper = require('../helpers/userhelper')();

//Testing remove
// userhelper.assignBlueSquareforTimeNotMet();
// setTimeout(()=>{
//   userhelper.awardNewBadges();
// }, 2000)

const userProfileScheduledJobs = function () {
  const assignBlueSquare = new CronJob(
    '2 0 * * 0',
    userhelper.assignBlueSquareforTimeNotMet,
    null,
    false,
    'America/Los_Angeles',
  );

  const emailWeeklySummaries = new CronJob(
    '5 0 * * 0', // Every Sunday, 5 minutes past midnight.
    userhelper.emailWeeklySummariesForAllUsers,
    null,
    false,
    'America/Los_Angeles',
  );

  const awardNewBadges = new CronJob(
    '15 0 * * 0', // Every Sunday, 15 minutes past midnight.
    userhelper.awardNewBadges,
    null,
    false,
    'America/Los_Angeles',
  );

  const deleteBlueSquareOlderThanYear = new CronJob(
    '0 0 * * *',
    userhelper.deleteBlueSquareAfterYear,
    null,
    false,
    'America/Los_Angeles',
  );
                                                 
  const updateUserStatusToActive = new CronJob(
    '1 0 * * *', // Run this every day, 1 minute after mimdnight (PST).
    userhelper.reActivateUser,
    null,
    false,
    'America/Los_Angeles',
  );

  assignBlueSquare.start();
  emailWeeklySummaries.start();
  deleteBlueSquareOlderThanYear.start();
  updateUserStatusToActive.start();
  awardNewBadges.start();
};

module.exports = userProfileScheduledJobs;
