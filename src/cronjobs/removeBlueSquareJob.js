const { CronJob } = require('cron');
const moment = require('moment-timezone');

const userhelper = require('../helpers/userHelper')();

const removeBlueSquareJob = () => {
    const removeBlueSquareForNewUserJob = CronJob(
        '0 2 * * 0', // Every sunday, at 2:00AM (PST). 
        async() => {
            await userhelper.notifyBlueSquareRemoval();
        },
        null,
        false,
        'America/Los_Angeles',
    );

    removeBlueSquareForNewUserJob.start();
};
modules.exports = removeBlueSquareJob;