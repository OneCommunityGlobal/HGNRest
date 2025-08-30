// HGNRest/src/utilities/dateRanges.js
const {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subWeeks,
  subMonths,
  subYears,
} = require('date-fns');

function getRangeFromQuery(q = {}) {
  const now = new Date();
  if (q.startDate && q.endDate) {
    return { start: new Date(q.startDate), end: new Date(q.endDate), type: 'custom' };
  }
  const filter = String(q.filter || '').toLowerCase();
  switch (filter) {
    case 'weekly':
      return { start: startOfWeek(now), end: endOfWeek(now), type: 'weekly' };
    case 'yearly':
      return { start: startOfYear(now), end: endOfYear(now), type: 'yearly' };
    case 'monthly':
    default:
      return { start: startOfMonth(now), end: endOfMonth(now), type: 'monthly' };
  }
}

function getPreviousRange(current) {
  switch (current.type) {
    case 'weekly':
      return { start: subWeeks(current.start, 1), end: subWeeks(current.end, 1), type: 'weekly' };
    case 'monthly':
      return {
        start: subMonths(current.start, 1),
        end: subMonths(current.end, 1),
        type: 'monthly',
      };
    case 'yearly':
      return { start: subYears(current.start, 1), end: subYears(current.end, 1), type: 'yearly' };
    default:
      return null;
  }
}

module.exports = { getRangeFromQuery, getPreviousRange };
