const cron = require('node-cron');
const XScheduledPost = require('../models/xScheduledPost');

async function runScheduler() {
  try {
    const result = await XScheduledPost.updateMany(
      { scheduledAt: { $lte: new Date() }, status: 'pending' },
      { $set: { status: 'ready' } },
    );
    if (result.modifiedCount > 0) {
      console.log(`[xScheduler] Promoted ${result.modifiedCount} post(s) to ready`);
    }
  } catch (err) {
    console.error('[xScheduler] Error promoting posts:', err.message);
  }
}

function start() {
  cron.schedule('* * * * *', runScheduler);
}

module.exports = { start, runScheduler };
