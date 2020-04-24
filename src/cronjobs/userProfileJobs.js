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

  const deleteBlueSquareOlderThanYear = new CronJob(
    '0 0 * * *',
    userhelper.deleteBlueSquareAfterYear,
    null,
    false,
    'America/Los_Angeles',
  );

  assignBlueSquare.start();
  deleteBlueSquareOlderThanYear.start();
};

module.exports = userProfileScheduledJobs;
