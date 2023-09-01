const { CronJob } = require('cron');

const userhelper = require('../helpers/userHelper')();

const tempJob = () => {
    const shiftSummary = new CronJob(
        '15 * * * *', // Every hh:05.
        async () => {
            await userhelper.assignBlueSquareForTimeNotMet();
        },
        null,
        false,
        'America/Los_Angeles',
    );

    shiftSummary.start();
};
module.exports = tempJob;