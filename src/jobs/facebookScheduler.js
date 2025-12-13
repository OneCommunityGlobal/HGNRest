const cron = require('node-cron');
const ScheduledFacebookPost = require('../models/scheduledFacebookPost');
const { publishToFacebook } = require('../controllers/facebookController');
const logger = require('../startup/logger');

const PST_TIMEZONE = 'America/Los_Angeles';
const MAX_POSTS_PER_TICK = 5;

const processNextScheduledPost = async () => {
  let nextPost;

  try {
    nextPost = await ScheduledFacebookPost.findOneAndUpdate(
      { status: 'pending', scheduledFor: { $lte: new Date() } },
      { status: 'sending', lastError: null },
      { sort: { scheduledFor: 1 }, new: true },
    ).exec();

    if (!nextPost) return false;

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

    console.log('[FacebookScheduler] Successfully posted:', nextPost._id);
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

        console.log('[FacebookScheduler] Marked as failed:', nextPost._id, errorMessage);
      } catch (saveError) {
        console.error('[FacebookScheduler] Failed to save error status:', saveError.message);
      }
    }

    // Only log to Sentry if logger has the method
    if (logger && typeof logger.logException === 'function') {
      logger.logException(error, 'facebookScheduler.process', {
        scheduledId: nextPost?._id?.toString(),
      });
    }
  }

  return true;
};

const startFacebookScheduler = () => {
  console.log('[FacebookScheduler] Starting cron job...');

  cron.schedule(
    '* * * * *',
    async () => {
      let processedCount = 0;
      while (processedCount < MAX_POSTS_PER_TICK) {
        const processed = await processNextScheduledPost();
        if (!processed) break;
        processedCount += 1;
      }
      if (processedCount > 0) {
        console.log(`[FacebookScheduler] Processed ${processedCount} post(s)`);
      }
    },
    { timezone: PST_TIMEZONE },
  );
};

module.exports = startFacebookScheduler;
