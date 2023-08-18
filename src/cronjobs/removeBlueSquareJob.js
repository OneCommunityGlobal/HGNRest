const { CronJob } = require('cron');

const userhelper = require('../helpers/userHelper')();

const removeBlueSquareJob = () => {
    const removeBlueSquareForNewUserJob = new CronJob(
        '0 2 * * 0', // Every sunday, at 2:00AM (PST).
        async () => {
            await userhelper.removeBlueSquareAndSendEmail();
        },
        null,
        false,
        'America/Los_Angeles',
    );

    removeBlueSquareForNewUserJob.start();
};
module.exports = removeBlueSquareJob;
