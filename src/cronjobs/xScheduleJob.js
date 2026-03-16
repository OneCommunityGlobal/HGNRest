const cron = require('node-cron');
const XScheduledPost = require('../models/xScheduledPost');
const XPostHistory = require('../models/xPostHistory');
const { postToX } = require('../controllers/xPostController');

/**
 * Process a single scheduled post: attempt to post, record history,
 * update the scheduled post status regardless of outcome.
 */
async function processScheduledPost(post) {
  const result = await postToX(post.content);

  if (result.success) {
    post.status = 'posted';
    post.postedAt = new Date();
    post.xPostId = result.data.id;
    post.errorMessage = null;
  } else {
    post.status = 'failed';
    post.errorMessage = result.error;
  }
  await post.save();

  await XPostHistory.create({
    content: post.content,
    xPostId: result.data?.id || null,
    status: result.success ? 'posted' : 'failed',
    source: 'scheduled',
    errorMessage: result.error,
    postedAt: result.success ? new Date() : null,
    scheduledPostId: post._id,
    createdBy: post.createdBy,
  });

  const label = result.success ? 'Posted' : 'Failed';
  console.log(`[X Scheduler] ${label}: "${post.content.slice(0, 50)}..." (${post._id})`);
}

/**
 * Main tick: find all due posts and process them sequentially.
 * Sequential processing is deliberate — it respects X's rate limits
 * by avoiding concurrent API calls from the same account.
 */
async function runScheduler() {
  try {
    const duePosts = await XScheduledPost.find({
      status: 'scheduled',
      scheduledAt: { $lte: new Date() },
    }).sort({ scheduledAt: 1 });

    if (duePosts.length === 0) return;

    console.log(`[X Scheduler] Processing ${duePosts.length} due post(s)`);

    for (const post of duePosts) {
      try {
        await processScheduledPost(post);
      } catch (err) {
        // Catch-all so one bad post doesn't stop the rest
        console.error(`[X Scheduler] Unexpected error for ${post._id}:`, err.message);
        post.status = 'failed';
        post.errorMessage = `Unexpected: ${err.message}`;
        await post.save().catch(() => {});
      }
    }
  } catch (err) {
    console.error('[X Scheduler] Query error:', err.message);
  }
}

/**
 * Start the cron job. Runs every minute, matching the pattern
 * used by the existing Mastodon scheduler.
 */
function start() {
  console.log('[X Scheduler] Starting (runs every minute)');
  cron.schedule('* * * * *', runScheduler);
}

module.exports = { start, runScheduler, processScheduledPost };
