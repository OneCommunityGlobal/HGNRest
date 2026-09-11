// cronjobs/instagramTokenRefreshJob.js
const cron = require('node-cron'); // or whatever scheduler this repo already uses — check cronjobs/userProfileJobs.js for the pattern
const refreshInstagramToken = require('../services/refreshInstagramToken');
const logger = require('../startup/logger');

module.exports = () => {
  // Run daily at 3am — refreshing well before the 60-day expiry
  cron.schedule('0 3 * * *', async () => {
    try {
      const tokenDoc = await refreshInstagramToken();
      logger.logInfo(`Instagram token refreshed, expires ${tokenDoc.expiresAt}`);
    } catch (err) {
      logger.logException(err, 'Instagram token refresh failed');
    }
  });
};
