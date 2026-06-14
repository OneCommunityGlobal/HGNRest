const cron = require('node-cron');
const XScheduledPost = require('../models/xScheduledPost');

const runScheduler = async () => {
  try {
    const result = await XScheduledPost.updateMany(
      { scheduledAt: { $lte: new Date() }, status: 'pending' },
      { $set: { status: 'ready' } },
    );
    if (result.modifiedCount > 0) {
      // eslint-disable-next-line no-console
      console.log(`[xScheduler] Promoted ${result.modifiedCount} post(s) to ready`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[xScheduler] Error promoting posts:', err.message);
  }
};

const start = () => cron.schedule('* * * * *', runScheduler);

module.exports = { start, runScheduler };
