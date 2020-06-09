import { CronJob } from 'cron';

const userhelper = require('../helpers/userhelper')();

const userProfileScheduledJobs = function () {
  const assignBlueBadge = new CronJob(
    '0 0 * * 0',
    userhelper.assignBlueBadges,
    null,
    false,
    'America/Los_Angeles',
  );

  const emailWeeklySummaries = new CronJob(
    '5 0 * * 0', // Every Sunday, 5 minutes past midnight.
    userhelper.emailweeklySummariesForAllUsers,
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
  emailWeeklySummaries.start();
  deleteBlueBadgeOlderThanYear.start();
};

module.exports = userProfileScheduledJobs;
