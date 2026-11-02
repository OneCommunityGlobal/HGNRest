const moment = require('moment-timezone');

const DATE_FORMAT = 'YYYY-MM-DD';

const DAYS_IN_WEEK = 7;

const REPORTS = [
  { key: 'week', label: 'Week-over-Week', comparison: 'Week Over Week', days: 7 },
  { key: 'month', label: 'Month-over-Month', comparison: 'Month Over Month', days: 28 },
  { key: 'year', label: 'Year-over-Year', comparison: 'Year Over Year', days: 365 },
];

/**
 * Builds the three report windows relative to the last completed Sunday-to-Saturday
 * week in the given timezone. Each window ends on that Saturday, and the comparison
 * window is the same number of days immediately before it.
 */
const buildReportPeriods = (now, timezone) => {
  const weekStart = moment.tz(now, timezone).startOf('week');
  const currentEnd = weekStart.clone().subtract(1, 'day');

  return REPORTS.map((report) => {
    const currentStart = currentEnd.clone().subtract(report.days - 1, 'days');
    const compareEnd = currentStart.clone().subtract(1, 'day');
    const compareStart = compareEnd.clone().subtract(report.days - 1, 'days');
    return {
      ...report,
      from: currentStart.format(DATE_FORMAT),
      to: currentEnd.format(DATE_FORMAT),
      compareFrom: compareStart.format(DATE_FORMAT),
      compareTo: compareEnd.format(DATE_FORMAT),
    };
  });
};

// One run per completed week: the Sunday that starts the week being reported.
const getRunKey = (now, timezone) =>
  moment.tz(now, timezone).startOf('week').subtract(DAYS_IN_WEEK, 'days').format(DATE_FORMAT);

const formatReportDate = (now, timezone) => moment.tz(now, timezone).format('MMMM D, YYYY');

module.exports = { REPORTS, DATE_FORMAT, buildReportPeriods, getRunKey, formatReportDate };
