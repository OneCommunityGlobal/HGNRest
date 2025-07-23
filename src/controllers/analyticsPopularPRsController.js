function getLastSunday(today = new Date()) {
  const dayOfWeek = today.getDay();
  today.setDate(today.getDate() - dayOfWeek);
  today.setHours(0, 0, 0, 0);
  return today;
}

function getFirstDayInMonth(duration, today = new Date()) {
  today.setMonth(today.getMonth() - duration);
  today.setDate(1);
  today.setHours(0, 0, 0, 0);
  return today;
}

function getStartDate(duration) {
  let startDate = null;
  let endDate = null;
  switch (duration) {
    case 'lastWeek': {
      const lastSunday = getLastSunday();
      startDate = new Date(lastSunday);
      endDate = new Date(lastSunday);
      startDate.setDate(startDate.getDate() - 7);
      break;
    }
    case 'last2weeks': {
      const lastSunday = getLastSunday();
      startDate = new Date(lastSunday);
      endDate = new Date(lastSunday);
      startDate.setDate(startDate.getDate() - 14);
      break;
    }
    case 'lastMonth': {
      startDate = getFirstDayInMonth(1);
      endDate = getFirstDayInMonth(0);
      break;
    }
    default:
      break;
  }
  if (startDate != null) {
    startDate.setHours(0, 0, 0, 0);
  }
  if (endDate != null) {
    endDate.setHours(0, 0, 0, 0);
  }
  return [startDate, endDate];
}

module.exports = () => ({
  getPopularPRs: async (req, res) => {
    try {
      const { duration = 'allTime' } = req.query;
      const [startDate, endDate] = getStartDate(duration);
      res.json({ startDate, endDate });
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
});
