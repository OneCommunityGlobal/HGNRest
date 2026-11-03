const moment = require('moment-timezone');

const COMPANY_TZ = 'America/Los_Angeles';
const MAX_WEEK_INDEX = 3;

/**
 * Returns which Weekly Summaries Report tab a user's final week belongs to,
 * measured back from the current week in company time (Pacific):
 * 0 = This Week, 1 = Last Week, 2 = Week Before Last, 3 = Three Weeks Ago.
 *
 * Returns null when endDate is missing or invalid, falls in a future week,
 * or is older than the four-week window the report shows.
 *
 * The caller decides whether the index applies. It is only meaningful for
 * users who are no longer active; a scheduled separation that has not
 * happened yet should not be treated as a final week.
 *
 * @param {Date|string|null|undefined} endDate The user's final day.
 * @param {Date} [now=new Date()] Reference time, injectable for tests.
 * @returns {number|null}
 */
const getFinalWeekIndex = (endDate, now = new Date()) => {
  if (!endDate) return null;
  // Parse strings strictly as ISO 8601 so malformed values return null
  // instead of falling back to moment's deprecated loose parsing.
  const end = endDate instanceof Date ? moment(endDate) : moment(endDate, moment.ISO_8601, true);
  if (!end.isValid()) return null;

  const endWeekStart = end.tz(COMPANY_TZ).startOf('week');
  const currentWeekStart = moment(now).tz(COMPANY_TZ).startOf('week');

  // Count calendar days and round, so a DST shift (a 167- or 169-hour
  // week) cannot truncate the result by one.
  const weeksAgo = Math.round(currentWeekStart.diff(endWeekStart, 'days', true) / 7);

  if (weeksAgo < 0 || weeksAgo > MAX_WEEK_INDEX) return null;
  return weeksAgo;
};

module.exports = { getFinalWeekIndex, COMPANY_TZ, MAX_WEEK_INDEX };
