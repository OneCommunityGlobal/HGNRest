const { CronJob } = require('cron');

const userhelper = require('../helpers/userHelper')();

const tempJob = () => {
    const shiftSummary = new CronJob(
        '0 * * * *', // Every hh:52.
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