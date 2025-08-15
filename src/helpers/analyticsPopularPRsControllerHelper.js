function getLastSunday(today = new Date()) {
  const dayOfWeek = today.getUTCDay();
  today.setUTCDate(today.getUTCDate() - dayOfWeek);
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function getFirstDayInMonth(duration, today = new Date()) {
  today.setUTCMonth(today.getUTCMonth() - duration);
  today.setUTCDate(1);
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function parseDurationValue(duration) {
  let startDate = null;
  let endDate = null;
  switch (duration) {
    case 'lastWeek': {
      const lastSunday = getLastSunday();
      startDate = new Date(lastSunday);
      endDate = new Date(lastSunday);
      startDate.setUTCDate(startDate.getUTCDate() - 7);
      break;
    }
    case 'last2weeks': {
      const lastSunday = getLastSunday();
      startDate = new Date(lastSunday);
      endDate = new Date(lastSunday);
      startDate.setUTCDate(startDate.getUTCDate() - 14);
      break;
    }
    case 'lastMonth': {
      startDate = getFirstDayInMonth(1);
      endDate = getFirstDayInMonth(0);
      break;
    }
    default: {
      startDate = new Date('1970-01-01T00:00:00Z');
      endDate = new Date();
      break;
    }
  }

  return [startDate, endDate];
}

module.exports = { parseDurationValue, getLastSunday, getFirstDayInMonth };
