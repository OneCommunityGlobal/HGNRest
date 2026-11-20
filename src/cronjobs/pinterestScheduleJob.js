const { CronJob } = require('cron');
const pinterestSchedule = require('../models/pinterestSchedule');
const { postPinImmediately } = require('../controllers/socialMediaControllers');

const MAX_ATTEMPTS = 3;

async function processDuePins() {
  const now = new Date();
  /* eslint-disable no-await-in-loop -- pins are claimed and posted sequentially on purpose */
  while (true) {
    // Atomically claim one due pin so no other run/instance can grab it
    const scheduledPin = await pinterestSchedule.findOneAndUpdate(
      {
        scheduledTime: { $lte: now },
        status: { $in: [undefined, null, 'pending'] },
      },
      { $set: { status: 'processing', processingStartedAt: new Date() } },
      { sort: { scheduledTime: 1 }, new: true },
    );

    if (!scheduledPin) break; // nothing left to do

    try {
      const postData = JSON.parse(scheduledPin.postData);
      await postPinImmediately(postData);
      await pinterestSchedule.deleteOne({ _id: scheduledPin._id });
    } catch (err) {
      console.error(`Failed to post scheduled pin ${scheduledPin._id}:`, err);

      const attempts = (scheduledPin.attempts || 0) + 1;
      await pinterestSchedule.updateOne(
        { _id: scheduledPin._id },
        {
          $set: {
            status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            attempts,
            lastError: String(err.message || err),
          },
        },
      );
    }
  }
}

function pinterestScheduleJob() {
  let running = false; // guards against overlap within this process

  const job = new CronJob('* * * * *', async () => {
    if (running) return;
    running = true;
    try {
      await processDuePins();
    } catch (err) {
      console.error('Pinterest schedule job error:', err);
    } finally {
      running = false;
    }
  });

  job.start();
  return job;
}

module.exports = pinterestScheduleJob;
