const moment = require('moment-timezone');

const getServerTime = (req, res) => {
  const serverTime = moment().tz('America/Los_Angeles');

  // Fixed date for backend testing
  // const serverTime = moment.tz(
  //   '2026-11-21 12:00:00',
  //   'YYYY-MM-DD HH:mm:ss',
  //   'America/Los_Angeles',
  // );

  return res.status(200).json({
    serverTime: serverTime.toISOString(),
    date: serverTime.format('YYYY-MM-DD'),
    timezone: 'America/Los_Angeles',
    timestamp: serverTime.valueOf(),
  });
};

module.exports = {
  getServerTime,
};
