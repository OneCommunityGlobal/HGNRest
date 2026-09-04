const InstagramScheduledPost = require('../models/instagramScheduledPost');
const InstagramPostHistory = require('../models/instagramPostHistory');
const { publishInstagramPost } = require('./instagramServices');

const runInstagramScheduler = async () => {
  const now = new Date();

  const posts = await InstagramScheduledPost.find({
    status: 'scheduled',
    scheduledTime: {
      $lte: now,
    },
  }).limit(20);

  for (const post of posts) {
    try {
      const locked = await InstagramScheduledPost.findOneAndUpdate(
        {
          _id: post._id,
          status: 'scheduled',
        },
        {
          $set: {
            status: 'publishing',
          },
          $inc: {
            attempts: 1,
          },
        },
        {
          new: true,
        },
      );

      if (!locked) {
        continue;
      }

      const instagramAccountId = process.env.INSTAGRAM_ACCOUNT_ID;

      const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

      const result = await publishInstagramPost({
        instagramAccountId,
        accessToken,
        caption: post.caption,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
      });

      await InstagramScheduledPost.findByIdAndUpdate(post._id, {
        status: 'published',
        creationId: result.creationId,
        instagramMediaId: result.instagramMediaId,
        permalink: result.permalink,
        lastError: null,
      });

      await InstagramPostHistory.create({
        userId: post.userId,
        caption: post.caption,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        instagramMediaId: result.instagramMediaId,
        permalink: result.permalink,
        postedAt: new Date(),
        status: 'published',
      });
    } catch (err) {
      console.error(`[Instagram Scheduler] Failed ${post._id}:`, err.response?.data || err.message);

      await InstagramScheduledPost.findByIdAndUpdate(post._id, {
        status: 'failed',
        lastError: err.response?.data?.error?.message || err.message,
      });

      await InstagramPostHistory.create({
        userId: post.userId,
        caption: post.caption,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        postedAt: new Date(),
        status: 'failed',
        error: err.response?.data?.error?.message || err.message,
      });
    }
  }
};

module.exports = {
  runInstagramScheduler,
};
