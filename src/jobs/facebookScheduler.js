const cron = require('node-cron');
const ScheduledFacebookPost = require('../models/scheduledFacebookPost');
const { publishToFacebook, getCredentials } = require('../controllers/facebookController');
const logger = require('../startup/logger');

const PST_TIMEZONE = 'America/Los_Angeles';
const MAX_POSTS_PER_TICK = 5;

/**
 * Processes the next pending scheduled post.
 * Uses credentials from OAuth connection or falls back to env vars.
 */
const processNextScheduledPost = async () => {
  let nextPost;

  try {
    // Check if we have valid credentials before processing
    const credentials = await getCredentials();
    if (!credentials) {
      return false;
    }

    nextPost = await ScheduledFacebookPost.findOneAndUpdate(
      { status: 'pending', scheduledFor: { $lte: new Date() } },
      { status: 'sending', lastError: null },
      { sort: { scheduledFor: 1 }, new: true },
    ).exec();

    if (!nextPost) return false;

    console.log('[FacebookScheduler] Processing post:', nextPost._id);

    const result = await publishToFacebook({
      message: nextPost.message,
      link: nextPost.link,
      imageUrl: nextPost.imageUrl,
      pageId: nextPost.pageId,
    });

    nextPost.status = 'sent';
    nextPost.postedAt = new Date();
    nextPost.postId = result.postId;
    nextPost.postType = result.postType;
    nextPost.attempts += 1;
    nextPost.lastError = null;
    await nextPost.save();

    console.log(
      '[FacebookScheduler] Successfully posted:',
      nextPost._id,
      '-> FB Post ID:',
      result.postId,
    );
    return true;
  } catch (error) {
    console.error('[FacebookScheduler] Error processing post:', error.message);

    if (nextPost) {
      try {
        // Ensure lastError is a string
        let errorMessage = 'Unknown error';
        if (typeof error.details === 'string') {
          errorMessage = error.details;
        } else if (typeof error.details === 'object' && error.details?.message) {
          errorMessage = error.details.message;
        } else if (error.message) {
          errorMessage = error.message;
        }

        nextPost.status = 'failed';
        nextPost.attempts += 1;
        nextPost.lastError = errorMessage;
        await nextPost.save();

        console.log('[FacebookScheduler] Marked as failed:', nextPost._id, '-', errorMessage);
      } catch (saveError) {
        console.error('[FacebookScheduler] Failed to save error status:', saveError.message);
      }
    }

    // Log to Sentry if available
    if (logger && typeof logger.logException === 'function') {
      logger.logException(error, 'facebookScheduler.process', {
        scheduledId: nextPost?._id?.toString(),
      });
    }

    return true; // Return true to continue processing other posts
  }
};

/**
 * Checks if credentials are available and logs status periodically
 */
let lastCredentialCheck = 0;
const CREDENTIAL_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

const checkCredentialsStatus = async () => {
  const now = Date.now();
  if (now - lastCredentialCheck < CREDENTIAL_CHECK_INTERVAL) {
    return;
  }
  lastCredentialCheck = now;

  const credentials = await getCredentials();
  if (!credentials) {
    console.log(
      '[FacebookScheduler] Warning: No Facebook credentials configured. Scheduled posts will not be sent.',
    );
  } else {
    console.log('[FacebookScheduler] Credentials available from:', credentials.source);
  }
};

/**
 * Starts the Facebook scheduler cron job.
 * Runs every minute to check for posts that need to be sent.
 */
const startFacebookScheduler = () => {
  console.log('[FacebookScheduler] Starting cron job...');

  // Initial credential check
  checkCredentialsStatus();

  cron.schedule(
    '* * * * *',
    async () => {
      // Periodic credential status check
      await checkCredentialsStatus();

      let processedCount = 0;
      while (processedCount < MAX_POSTS_PER_TICK) {
        const processed = await processNextScheduledPost();
        if (!processed) break;
        processedCount += 1;
      }
      if (processedCount > 0) {
        console.log(`[FacebookScheduler] Processed ${processedCount} post(s) this tick`);
      }
    },
    { timezone: PST_TIMEZONE },
  );
};

module.exports = startFacebookScheduler;
