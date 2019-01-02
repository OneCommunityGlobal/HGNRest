import { CronJob } from 'cron';

const userhelper = require('../helpers/userhelper')();

const userProfileScheduledJobs = function () {
  const assignBlueBadge = new CronJob(
    '0 0 * * 0',
    userhelper.assignBlueBadgeforTimeNotMet,
    null,
    false,
    'America/Los_Angeles',
  );

  const deleteBlueBadgeOlderThanYear = new CronJob(
    '0 0 * * *',
    userhelper.deleteBadgeAfterYear,
    null,
    false,
    'America/Los_Angeles',
  );

  assignBlueBadge.start();
  deleteBlueBadgeOlderThanYear.start();
};

module.exports = userProfileScheduledJobs;
