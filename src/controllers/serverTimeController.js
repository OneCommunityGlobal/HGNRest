const moment = require('moment');

const getServerTime = (req, res) => {
  try {
    // const serverTime = moment();
    const serverTime = moment('2026-07-09T10:00:00'); // Testing purposes

    res.status(200).json({
      serverTime: serverTime.toISOString(),
      date: serverTime.format('YYYY-MM-DD'),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: serverTime.valueOf(),
    });
  } catch (error) {
    console.error('Error fetching server time:', error);

    res.status(500).json({
      error: 'Unable to fetch server time',
    });
  }
};

module.exports = {
  getServerTime,
};
