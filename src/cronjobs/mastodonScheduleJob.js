const { CronJob } = require('cron');
const moment = require('moment-timezone');
const mastodonSchedule = require('../models/mastodonSchedule');
const { postPinImmediately } = require('../controllers/mastodonPostController')


async function mastodonScheduleJob() {
    new CronJob('* * * * *', async () => {
        try {
            const now = new Date().toISOString();
            const scheduledList = await mastodonSchedule.find({ scheduledTime: { $lte: now } });

            for (const scheduledStatus of scheduledStatusList) {
                const postData = JSON.parse(scheduledStatus.postData);
                // console.log(`Creating pin: ${scheduledPin}`)
                await postImmediately(postData);

                // Delete database record after posting to mastodon
                await mastodonSchedule.deleteOne(scheduledStatus);
            }
        } catch (err) {
            console.log(err);
        }
    }).start();

}

module.exports = mastodonScheduleJob;