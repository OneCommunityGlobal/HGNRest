const moment = require('moment');

const getServerTime = (req, res) => {
  const serverTime = moment();

  res.status(200).json({
    serverTime: serverTime.toISOString(),
    date: serverTime.format('YYYY-MM-DD'),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: serverTime.valueOf(),
  });
};

module.exports = {
  getServerTime,
};
