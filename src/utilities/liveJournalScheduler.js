// eslint-disable-next-line import/no-unresolved
const schedule = require('node-schedule');
const liveJournalPostController = require('../controllers/liveJournalPostController')();

const initializeLiveJournalScheduler = () => {
  const job = schedule.scheduleJob('* * * * *', async () => {
    try {
      const result = await liveJournalPostController.processScheduledPosts();

      if (result.processed > 0) {
        console.log(
          `[LiveJournal Scheduler] Processed ${result.processed} posts: ${result.successful} successful, ${result.failed} failed`,
        );
      }
    } catch (error) {
      console.error('[LiveJournal Scheduler] Error processing scheduled posts:', error);
    }
  });

  console.log('[LiveJournal Scheduler] Initialized - will check for scheduled posts every minute');

  return job;
};

module.exports = { initializeLiveJournalScheduler };
