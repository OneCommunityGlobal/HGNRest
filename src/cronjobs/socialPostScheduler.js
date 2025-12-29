const { CronJob } = require('cron');
const moment = require('moment-timezone');
const ScheduledPost = require('../models/scheduledPostSchema');
const { postToPlurk } = require('../controllers/plurkController');

const socialPostScheduler = () => {
  const checkScheduledPosts = new CronJob(
    '*/1 * * * *', // Run every minute
    async () => {
      console.log('cron job started');
      const now = moment().tz('America/Chicago').format('YYYY-MM-DD HH:mm');
      console.log('Current date and time:', now);

      try {
        const posts = await ScheduledPost.find({ status: 'scheduled' });

        posts.forEach(async (post) => {
          // Attempt to parse the date/time from the post
          // We handle both YYYY-MM-DD HH:mm and MM/DD/YYYY h:mm A to be safe
          let scheduledDateTime = moment.tz(
            `${post.scheduledDate} ${post.scheduledTime}`,
            'YYYY-MM-DD HH:mm',
            'America/Chicago',
          );

          if (!scheduledDateTime.isValid()) {
            scheduledDateTime = moment.tz(
              `${post.scheduledDate} ${post.scheduledTime}`,
              'MM/DD/YYYY h:mm A',
              'America/Chicago',
            );
          }

          const formattedScheduledTime = scheduledDateTime.format('YYYY-MM-DD HH:mm');

          if (formattedScheduledTime === now) {
            console.log(`Running scheduled task for ${post.platform} at`, new Date());

            try {
              switch (post.platform) {
                case 'plurk':
                  await postToPlurk(post.textContent);
                  console.log('Successfully posted to Plurk');
                  break;
                default:
                  // Ignore other platforms for now or log
                  // console.error('Unknown platform:', post.platform);
                  break;
              }

              // Remove the post after execution (or update status to posted)
              // The Shefali branch deletes it. The schema has a status field though.
              // I will delete it to match the requested logic "delete schedule post logic"
              // but createTweet in Shefali updates status to posted (wait, no, createTweet SAVES with status posted).
              // The cron job in Shefali DELETES the post.
              await ScheduledPost.findByIdAndDelete(post._id);
            } catch (error) {
              console.error(`Failed to execute scheduled task for ${post.platform}:`, error);
            }
          }
        });
      } catch (err) {
        console.error('Error fetching scheduled posts:', err);
      }
    },
    null,
    false,
    'America/Chicago',
  );

  checkScheduledPosts.start();
};

module.exports = socialPostScheduler;
