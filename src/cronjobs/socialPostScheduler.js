const { CronJob } = require('cron');
const moment = require('moment-timezone');
const ScheduledPost = require('../models/scheduledPostSchema');
const socialMediaController = require('../controllers/socialMediaController');

const socialPostScheduler = () => {
  const checkScheduledPosts = new CronJob(
    // '*/1 * * * *', // Run every minute for testing
    '0 0 * * *', // Run once daily at midnight
    async () => {
      console.log('cron job started');
      const now = moment().tz('America/Chicago').format('YYYY-MM-DD HH:mm'); // right now i kept timezone as america/chicago,will change later.
      console.log('Current date and time:', now);

      const posts = await ScheduledPost.find();

      posts.forEach(async (post) => {
        const scheduledDateTime = moment
          .tz(`${post.scheduledDate} ${post.scheduledTime}`, 'YYYY-MM-DD HH:mm', 'America/Chicago')
          .format('YYYY-MM-DD HH:mm');

        if (scheduledDateTime === now) {
          console.log(`Running scheduled task for ${post.platform} at`, new Date());

          switch (post.platform) {
            case 'twitter':
              await socialMediaController.postToTwitter(post.textContent, post.base64Srcs);
              break;
            default:
              console.error('Unknown platform:', post.platform);
          }

          // Remove the post after execution
          await ScheduledPost.findByIdAndDelete(post._id);
        }
      });
    },
    null,
    false,
    'America/Chicago',
  );

  checkScheduledPosts.start();
};

module.exports = socialPostScheduler;

// const { CronJob } = require('cron');
// const moment = require('moment-timezone');
// // const mongoose = require('mongoose');
// const ScheduledPost = require('../models/scheduledPostSchema');
// const socialMediaController = require('../controllers/socialMediaController');
// const socialPostScheduler = () => {
//   const checkScheduledPosts = new CronJob(
//     // '0 0 * * *', // Run once daily at midnight
//     // '0 0 * * *', // Run once daily at midnight
//     '*/1 * * * *', // Run every minute for testing
//     async () => {
//       console.log('cron job started');
//       const now = moment().tz('America/Chicago');
//       console.log('Current date and time:', now.format());
//       const posts = await ScheduledPost.find({
//       scheduledTime: {
//         $gte: now.startOf('minute').toDate(),
//         $lt: now.add(1, 'minute').toDate(),
//       },
//       });

//       posts.forEach(async (post) => {
//         console.log(`Running scheduled task for ${post.platform} at`, new Date());

//         switch (post.platform) {
//           case 'twitter':
//             await socialMediaController.postToTwitter(post.textContent, post.base64Srcs, post.scheduledTime);
//             break;
//           default:
//             console.error('Unknown platform:', post.platform);
//         }

//         // Remove the post after execution while testing
//         await ScheduledPost.findByIdAndDelete(post._id);
//       });
//     },
//     null,
//     false,
//     'America/Los_Angeles',
//   );

//   checkScheduledPosts.start();
// };

// module.exports = socialPostScheduler;
