// v1.0.0
const { CronJob } = require('cron');
const { captureDailyRisk } = require('../services/projectRiskHistory');
const logger = require('../startup/logger');

module.exports = () =>
  new CronJob(
    '0 5 0 * * *',
    async () => {
      try {
        await captureDailyRisk();
      } catch (error) {
        logger.logException(error, 'Project risk daily observations failed');
      }
    },
    null,
    true,
    'UTC',
  );
