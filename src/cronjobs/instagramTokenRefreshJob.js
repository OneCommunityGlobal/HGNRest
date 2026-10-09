const cron = require('node-cron');
const refreshInstagramToken = require('../services/refreshInstagramToken');
const logger = require('../startup/logger');

const scheduleInstagramTokenRefresh = () => {
  // Runs daily at 3am. The service only calls Meta when the token is within
  // its refresh window; otherwise it just checks the stored expiry and skips.
  cron.schedule('0 3 * * *', async () => {
    try {
      const { tokenDoc, refreshed } = await refreshInstagramToken();

      if (refreshed) {
        logger.logInfo(`Instagram token refreshed, expires ${tokenDoc.expiresAt}`);
      } else {
        logger.logInfo(`Instagram token refresh skipped, expires ${tokenDoc.expiresAt}`);
      }
    } catch (err) {
      // Log only a safe message. A raw axios error can include the request
      // params, which here contain the App Secret and the access token.
      const safeMessage = err?.response?.data?.error?.message || err?.message || 'Unknown error';
      logger.logException(new Error(safeMessage), 'Instagram token refresh failed');
    }
  });
};

module.exports = scheduleInstagramTokenRefresh;
