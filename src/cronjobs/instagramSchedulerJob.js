const cron = require('node-cron');
const { runInstagramScheduler } = require('../services/instagramScheduler');

// Run every minute
cron.schedule('* * * * *', async () => {
  try {
    await runInstagramScheduler();
  } catch (err) {
    console.error('[Instagram Scheduler] Error:', err.message);
  }
});
