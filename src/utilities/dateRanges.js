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

const ALLOWED = new Set(['weekly', 'monthly', 'yearly']);

function isISOLike(v) {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}

/**
 * Strict parser:
 * - either filter in weekly|monthly|yearly
 * - or both startDate & endDate (ISO-like)
 * Otherwise throws { status: 422, message }
 */
function getRangeFromQuery(q = {}) {
  const filter = String(q.filter || '').toLowerCase();

  if (q.startDate || q.endDate) {
    if (!isISOLike(q.startDate) || !isISOLike(q.endDate)) {
      const err = new Error('startDate and endDate must be ISO date strings.');
      err.status = 422;
      throw err;
    }
    return { start: new Date(q.startDate), end: new Date(q.endDate), type: 'custom' };
  }

  if (!filter) {
    const err = new Error(
      'Missing required query: filter=weekly|monthly|yearly (or provide startDate & endDate).',
    );
    err.status = 422;
    throw err;
  }
  if (!ALLOWED.has(filter)) {
    const err = new Error('Invalid filter. Allowed: weekly, monthly, yearly.');
    err.status = 422;
    throw err;
  }

  const now = new Date();
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
      return null; // 'custom' not comparable
  }
}

module.exports = { getRangeFromQuery, getPreviousRange };
