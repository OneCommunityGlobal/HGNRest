const { CronJob } = require('cron');
const moment = require('moment-timezone');
const pinterestSchedule = require('../models/pinterestSchedule');
const { postPinImmediately } = require('../controllers/socialMediaController')


async function pinterestScheduleJob() {
    new CronJob('* * * * *', async () => {
        try {
            const now = new Date().toISOString();
            const scheduledPinList = await pinterestSchedule.find({ scheduledTime: { $lte: now } });

            for (const scheduledPin of scheduledPinList) {
                const postData = JSON.parse(scheduledPin.postData);
                // console.log(`Creating pin: ${scheduledPin}`)
                await postPinImmediately(postData);

                //Delete database record after posting to pinterest
                await pinterestSchedule.deleteOne(scheduledPin);
            }
        } catch (err) {
            console.log(err);
        }
    }).start();

}

module.exports = pinterestScheduleJob;