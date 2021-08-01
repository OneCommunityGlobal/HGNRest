import { CronJob } from 'cron';

const userhelper = require('../helpers/userhelper')();

const userProfileScheduledJobs = function () {

  const updateUserStatusToActive = new CronJob(
    '1 0 * * *', // Run this every day, 1 minute after mimdnight (PST).
    userhelper.reActivateUser,
    null,
    false,
    'America/Los_Angeles',
  );

  const assignBlueSquare = new CronJob(
    '2 0 * * 0', // Every Sunday, 2 minutes past midnight (PST).
    userhelper.assignBlueSquareforTimeNotMet,
    null,
    false,
    'America/Los_Angeles',
  );

  const emailWeeklySummaries = new CronJob(
    '5 0 * * 0', // Every Sunday, 5 minutes past midnight (PST).
    userhelper.emailWeeklySummariesForAllUsers,
    null,
    false,
    'America/Los_Angeles',
  );

  const deleteBlueSquareOlderThanYear = new CronJob(
    '8 0 * * 0', // Every Sunday, 8 minutes past midnight (PST).
    userhelper.deleteBlueSquareAfterYear,
    null,
    false,
    'America/Los_Angeles',
  );

  const awardNewBadges = new CronJob(
    '15 0 * * 0', // Every Sunday, 15 minutes past midnight (PST).
    userhelper.awardNewBadges,
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
