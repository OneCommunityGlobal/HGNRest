const {
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
} = require('date-fns');

function getPresetRange(filter) {
  const now = new Date();
  switch (filter) {
    case 'weekly':
      return {
        current: {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        },
        previous: {
          start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
          end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
        },
      };
    case 'monthly':
      return {
        current: { start: startOfMonth(now), end: endOfMonth(now) },
        previous: { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) },
      };
    case 'yearly':
      return {
        current: { start: startOfYear(now), end: endOfYear(now) },
        previous: { start: startOfYear(subYears(now, 1)), end: endOfYear(subYears(now, 1)) },
      };
    default:
      return null;
  }
}

function pctChange(curr, prev) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

module.exports = { getPresetRange, pctChange };
