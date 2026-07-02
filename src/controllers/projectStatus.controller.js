const dayjs = require('dayjs');
const { getProjectStatusSummary } = require('../services/projectStatus.service');

exports.fetchProjectStatus = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate dates
    if (startDate && !dayjs(startDate, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({ message: 'Invalid startDate (YYYY-MM-DD)' });
    }
    if (endDate && !dayjs(endDate, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({ message: 'Invalid endDate (YYYY-MM-DD)' });
    }
    if (startDate && endDate && dayjs(startDate).isAfter(dayjs(endDate))) {
      return res.status(400).json({ message: 'startDate cannot be after endDate' });
    }

    const data = await getProjectStatusSummary({ startDate, endDate });
    return res.json(data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchProjectStatus error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
