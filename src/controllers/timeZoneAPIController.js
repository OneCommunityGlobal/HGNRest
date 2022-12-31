const hasPermission = require('../utilities/permissions');

const timeZoneAPIController = function () {
  const getTimeZoneAPIKey = (req, res) => {
    const requestorRole = req.body.requestor.role;
    const premiumKey = process.env.TIMEZONE_PREMIUM_KEY;
    const commonKey = process.env.TIMEZONE_COMMON_KEY;
    if (!req.body.requestor.role) {
      res.status(403).json('Unauthorized Request');
    } else if (hasPermission(requestorRole, 'getTimeZoneAPIKey')) {
    return res.status(200).send({ userAPIKey: premiumKey });
    } else {
       return res.status(200).send({ userAPIKey: commonKey });
    }
  };

  return {
    getTimeZoneAPIKey,
  };
};

module.exports = timeZoneAPIController;
