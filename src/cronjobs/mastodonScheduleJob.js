const { CronJob } = require('cron');
const mastodonSchedule = require('../models/mastodonSchedule');
const { postImmediately } = require('../controllers/mastodonPostController');

async function mastodonScheduleJob() {
  new CronJob('* * * * *', async () => {
    try {
      const now = new Date().toISOString();
      const scheduledStatusList = await mastodonSchedule.find({ scheduledTime: { $lte: now } });

      await Promise.all(
        scheduledStatusList.map(async (scheduledStatus) => {
          const postData = JSON.parse(scheduledStatus.postData);
          // console.log(`Creating pin: ${scheduledPin}`)
          await postImmediately(postData);

          // Delete database record after posting to mastodon
          await mastodonSchedule.deleteOne(scheduledStatus);
        }),
      );
    } catch (err) {
      console.log(err);
    }
  }).start();
}

module.exports = mastodonScheduleJob;
