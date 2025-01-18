const { CronJob } = require('cron');
const moment = require('moment-timezone');
// const mongoose = require('mongoose');
const ScheduledPost = require('../models/scheduledPostSchema');
const socialMediaController = require('../controllers/socialMediaController');

const socialPostScheduler = () => {
  const checkScheduledPosts = new CronJob(
    '0 0 * * *', // Run once daily at midnight
    // '*/1 * * * *',// Run every minute for testing
    async () => {
      console.log('cron jb started');
      const now = moment().tz('America/Los_Angeles').startOf('day');
      const posts = await ScheduledPost.find({
        scheduledTime: {
          $gte: now.toDate(),
          $lt: now.add(1, 'day').toDate(),
        },
      });

      posts.forEach(async (post) => {
        console.log(`Running scheduled task for ${post.platform} at`, new Date());

        switch (post.platform) {
          case 'twitter':
            await socialMediaController.postToTwitter(post.textContent, post.base64Srcs);
            break;
          default:
            console.error('Unknown platform:', post.platform);
        }

        // Remove the post after execution while testing
        // await ScheduledPost.findByIdAndDelete(post._id);
      });
    },
    null,
    false,
    'America/Los_Angeles',
  );

  checkScheduledPosts.start();
};

module.exports = socialPostScheduler;
