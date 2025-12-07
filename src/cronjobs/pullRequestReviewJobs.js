// eslint-disable-next-line no-unused-vars
const { CronJob } = require('cron');

const {
  syncGitHubData,
  acquireTodayJob,
} = require('../helpers/analyticsPopularPRsControllerHelper');

// const connectToMongo = require('../startup/db');

// connectToMongo();

const pullRequestReviewJobs = () => {
  const pullRequestReviewSyncJob = new CronJob(
    '0 1 0,2,4 * * *', // Everyday at midnight, 2am, 4am 1 minute Pacific time
    // '*/2 * * * *', // Every 2 minute, for testing
    async () => {
      // Check to see if any other server has already run the sync yet
      const todayJob = await acquireTodayJob();
      // Some other server has already run the sync job
      if (todayJob == null) {
        return;
      }
      await syncGitHubData(todayJob);
    },
    null,
    false,
    'America/Los_Angeles',
  );
  pullRequestReviewSyncJob.start();
};
module.exports = pullRequestReviewJobs;

// (async () => {
//   // Check to see if any other server has already run the sync yet
//   const todayJob = await acquireTodayJob();
//   // Some other server has already run the sync job
//   if (todayJob == null) {
//     console.log('Data has already synced today, skip');
//     return;
//   }
//   console.log (`Get today job! ID : ${todayJob.jobId}`);
//   await syncGitHubData(todayJob);
//   console.log ("Done syncing data. Status", todayJob.status);
//   console.log (todayJob.notes);
// })();
