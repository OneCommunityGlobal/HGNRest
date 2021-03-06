import { CronJob } from 'cron';

const userhelper = require('../helpers/userhelper')();

const userProfileScheduledJobs = function () {
  const assignBlueSquare = new CronJob(
    '0 0 * * 0',
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
};

module.exports = userProfileScheduledJobs;
