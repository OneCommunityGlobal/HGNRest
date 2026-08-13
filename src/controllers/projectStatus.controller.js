const dayjs = require('dayjs');
const { getProjectStatusSummary } = require('../services/projectStatus.service');

const validateDateParam = (label, value, today) => {
  if (!value) return null;
  if (!dayjs(value, 'YYYY-MM-DD', true).isValid()) {
    return `Invalid ${label} (YYYY-MM-DD)`;
  }
  if (dayjs(value).isAfter(today)) {
    return `${label} cannot be in the future`;
  }
  return null;
};

exports.fetchProjectStatus = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const today = dayjs().endOf('day');

    const dateError =
      validateDateParam('startDate', startDate, today) ||
      validateDateParam('endDate', endDate, today) ||
      (startDate && endDate && dayjs(startDate).isAfter(dayjs(endDate))
        ? 'startDate cannot be after endDate'
        : null);

    if (dateError) {
      return res.status(400).json({ message: dateError });
    }

    const data = await getProjectStatusSummary({ startDate, endDate });
    return res.json(data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchProjectStatus error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
