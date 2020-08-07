const moment = require('moment-timezone');
const userProfile = require('../models/userProfile');


const reporthelper = function () {
  /**
   * Get an array of objects, each containing selected fields from
   * the userProfile collection relative to the weekly summaries.
   *
   * @param {integer} startWeekIndex The start week index, eg. 0 for this week.
   * @param {integer} endWeekIndex The end week index, eg. 1 for last week.
   */
  const weeklySummaries = function (startWeekIndex, endWeekIndex) {
    const pstStartOfWeek = moment().tz('America/Los_Angeles').startOf('week').subtract(startWeekIndex, 'week');
    const pstEndOfWeek = moment().tz('America/Los_Angeles').endOf('week').subtract(endWeekIndex, 'week');
    const fromDate = moment(pstStartOfWeek).toDate();
    const toDate = moment(pstEndOfWeek).toDate();

    return userProfile.aggregate([{
      $match: {
        isActive: true,
      },
    },
    {
      $project: {
        firstName: 1,
        lastName: 1,
        mediaUrl: 1,
        weeklySummaries: {
          $filter: {
            input: '$weeklySummaries',
            as: 'ws',
            cond: {
              $and: [
                {
                  $gte: ['$$ws.dueDate', fromDate],
                }, {
                  $lte: ['$$ws.dueDate', toDate],
                },
              ],
            },
          },
        },
        weeklySummariesCount: 1,
      },
    },
    ]);
  };

  /**
   * Checks whether a date belongs to a specific week based on week index.
   *
   * @param {string} dueDate The date to check.
   * @param {integer} weekIndex An integer in the range 0 - 2, where 0 (this week),
   *                      1 (last week) or 2 (the week before last).
   * @return {boolean} True if match, false otherwise.
   */
  const doesDateBelongToWeek = function (dueDate, weekIndex) {
    const pstStartOfWeek = moment().tz('America/Los_Angeles').startOf('week').subtract(weekIndex, 'week');
    const pstEndOfWeek = moment().tz('America/Los_Angeles').endOf('week').subtract(weekIndex, 'week');
    const fromDate = moment(pstStartOfWeek).toDate();
    const toDate = moment(pstEndOfWeek).toDate();
    return moment(dueDate).isBetween(fromDate, toDate, undefined, '[]');
  };

  /**
   * Get the week index relative to this week, eg. 0 (this week),
   * 1 (last week) or 2 (the week before last).
   *
   * @param {string} dueDate The date to check.
   * @return {integer} The week index, -1 if no match.
   */
  const getTheWeek = function (dueDate) {
    if (doesDateBelongToWeek(dueDate, 0)) return 0;
    if (doesDateBelongToWeek(dueDate, 1)) return 1;
    if (doesDateBelongToWeek(dueDate, 2)) return 2;
    return -1;
  };

  /**
   * This function will make sure the weeklySummaries' array
   * has its entries always in the right position based on the dueDate.
   * That means that:
   *  - the 1st entry should always have the dueDate for this week.
   *  - the 2nd entry should always have the dueDate for last week.
   *  - the 3rd entry should always have the dueDate for the week before last.
   *
   * @param {Object} results An array of user objects with selected fields.
   * @return {Object} An array of user objects with properly sorted weeklySummaries by due date.
   */
  const formatSummaries = function (results) {
    return (results.map((user) => {
      const { weeklySummaries: wS } = user;
      const wSummaries = [];

      if (Array.isArray(wS) && wS.length && wS.length < 3) {
        // Common cases for the first entry.
        if (getTheWeek(wS[0].dueDate) === 0) wSummaries[0] = { ...wS[0] };
        if (getTheWeek(wS[0].dueDate) === 1) {
          wSummaries[0] = null;
          wSummaries[1] = { ...wS[0] };
        }
        // When single entry.
        if (wS.length === 1) {
        // Special case when first entry belongs to week before last.
          if (getTheWeek(wS[0].dueDate) === 2) {
            wSummaries[0] = null;
            wSummaries[1] = null;
            wSummaries[2] = { ...wS[0] };
          }
        } else { // When two entries.
          if (getTheWeek(wS[1].dueDate) === 1) wSummaries[1] = { ...wS[1] };
          if (getTheWeek(wS[1].dueDate) === 2) wSummaries[2] = { ...wS[1] };
        }
        user = { ...user, weeklySummaries: wSummaries };
      }
      return user;
    }));
  };

  return {
    weeklySummaries,
    formatSummaries,
  };
};

module.exports = reporthelper;
