const { CronJob } = require('cron');
const moment = require('moment-timezone');
const MediumPost = require('../models/mediumPost');
const mediumController = require('../controllers/mediumController');

const mediumPostScheduler = () => {
  const checkScheduledPosts = new CronJob(
    '*/1 * * * *', // Run every minute for testing
    async () => {
      console.log('Medium cron job started');
      const now = moment().tz('America/Chicago').format('YYYY-MM-DD HH:mm');
      console.log('Current date and time:', now);

      try {
        // Find posts that are scheduled and due
        const posts = await MediumPost.find({
          status: 'scheduled',
          scheduledDate: { $lte: new Date() },
        });

        for (const post of posts) {
          console.log(`Running scheduled task for Medium post ${post._id}`);

          try {
            const token = process.env.MEDIUM_INTEGRATION_TOKEN;

            if (!token) {
              throw new Error('MEDIUM_INTEGRATION_TOKEN not found in environment variables');
            }

            await mediumController.postToMedium(
              {
                title: post.title,
                content: post.content,
                tags: post.tags,
                publishStatus: 'draft', // Or 'public' based on requirement. Defaulting to draft for safety.
              },
              token,
            );

            console.log('Successfully posted to Medium for:', post.title);

            post.status = 'posted';
            await post.save();
          } catch (error) {
            console.error(`Failed to post to Medium for ${post._id}:`, error);
            post.status = 'failed';
            post.failureReason = error.message;
            await post.save();
          }
        }
      } catch (error) {
        console.error('Error in mediumPostScheduler:', error);
      }
    },
    null,
    false,
    'America/Chicago',
  );

  checkScheduledPosts.start();
};

module.exports = mediumPostScheduler;
