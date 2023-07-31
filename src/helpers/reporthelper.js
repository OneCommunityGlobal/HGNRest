const moment = require('moment-timezone');
const userProfile = require('../models/userProfile');
/**
 *
 * @param {*} dateOfWork
 * @param {*} pstEnd
 * @returns The absolute value of the difference in weeks between the two input dates.
 */
const absoluteDifferenceInWeeks = (dateOfWork, pstEnd) => {
  dateOfWork = moment(dateOfWork).endOf('week');
  pstEnd = moment(pstEnd).tz('America/Los_Angeles').endOf('week');
  return Math.abs(dateOfWork.diff(pstEnd, 'weeks'));
};
const reporthelper = function () {
  /**
   * Get an array of objects, each containing selected fields from
   * the userProfile collection relative to the weekly summaries.
   *
   * @param {integer} startWeekIndex The start week index, eg. 0 for this week.
   * @param {integer} endWeekIndex The end week index, eg. 1 for last week.
   */
  const weeklySummaries = async (startWeekIndex, endWeekIndex) => {
    const pstStart = moment()
      .tz('America/Los_Angeles')
      .startOf('week')
      .subtract(startWeekIndex, 'week')
      .toDate();
    const pstEnd = moment()
      .tz('America/Los_Angeles')
      .endOf('week')
      .subtract(endWeekIndex, 'week')
      .toDate();
    const results = await userProfile.aggregate([
      {
        $match: {
          isActive: true,
        },
      },
      {
        $lookup: {
          from: 'timeEntries',
          localField: '_id',
          foreignField: 'personId',
          as: 'timeEntries',
        },
      },
      {
        $project: {
          timeEntries: {
            $filter: {
              input: '$timeEntries',
              as: 'timeEntry',
              cond: {
                $and: [
                  {
                    $gte: [
                      '$$timeEntry.dateOfWork',
                      moment(pstStart).format('YYYY-MM-DD'),
                    ],
                  },
                  {
                    $lte: [
                      '$$timeEntry.dateOfWork',
                      moment(pstEnd).format('YYYY-MM-DD'),
                    ],
                  },
                ],
              },
            },
          },
          firstName: 1,
          lastName: 1,
          email: 1,
          mediaUrl: 1,
          weeklycommittedHours: 1,
          weeklySummaryNotReq: 1,
          weeklySummaryOption: 1,
          adminLinks: 1,
          bioPosted: 1,
          weeklySummaries: {
            $filter: {
              input: '$weeklySummaries',
              as: 'ws',
              cond: {
                $and: [
                  {
                    $gte: ['$$ws.dueDate', pstStart],
                  },
                  {
                    $lte: ['$$ws.dueDate', pstEnd],
                  },
                ],
              },
            },
          },
          weeklySummariesCount: 1,
          isTangible: 1,
        },
      },
    ]);
    // Logic too difficult to do using aggregation.
    results.forEach((result) => {
      result.totalSeconds = [];
      result.timeEntries.forEach((entry) => {
        const index = absoluteDifferenceInWeeks(entry.dateOfWork, pstEnd);
        if (
          result.totalSeconds[index] === undefined
          || result.totalSeconds[index] === null
        ) {
          result.totalSeconds[index] = 0;
        }
        if (entry.isTangible === true) {
          result.totalSeconds[index] += entry.totalSeconds;
        }
      });
      delete result.timeEntries;
    });
    return results;
  };
  /**
   * Checks whether a date belongs to a specific week based on week index.
   *
   * @param {string} dueDate The date to check.
   * @param {integer} weekIndex An integer in the range 0 - 3, where 0 (this week),
   *                      1 (last week), 2 (the week before last) or 3 (three weeks ago).
   * @return {boolean} True if match, false otherwise.
   */
  const doesDateBelongToWeek = function (dueDate, weekIndex) {
    const pstStartOfWeek = moment()
      .tz('America/Los_Angeles')
      .startOf('week')
      .subtract(weekIndex, 'week');
    const pstEndOfWeek = moment()
      .tz('America/Los_Angeles')
      .endOf('week')
      .subtract(weekIndex, 'week');
    const fromDate = moment(pstStartOfWeek).toDate();
    const toDate = moment(pstEndOfWeek).toDate();
    return moment(dueDate).isBetween(fromDate, toDate, undefined, '[]');
  };
  /**
   * Get the week index relative to this week, eg. 0 (this week),
   * 1 (last week), 2 (the week before last) or 3 (three weeks ago).
   *
   * @param {string} dueDate The date to check.
   * @return {integer} The week index, -1 if no match.
   */
  const getTheWeek = function (dueDate) {
    if (doesDateBelongToWeek(dueDate, 0)) return 0;
    if (doesDateBelongToWeek(dueDate, 1)) return 1;
    if (doesDateBelongToWeek(dueDate, 2)) return 2;
    if (doesDateBelongToWeek(dueDate, 3)) return 3;
    return -1;
  };
  /**
   * This function will make sure the weeklySummaries' array
   * has its entries always in the right position based on the dueDate.
   * That means that:
   *  - the 1st entry should always have the dueDate for this week.
   *  - the 2nd entry should always have the dueDate for last week.
   *  - the 3rd entry should always have the dueDate for the week before last.
   *  - the 4th entry should always have the dueDate for three weeks ago.
   *
   * @param {Object} results An array of user objects with selected fields.
   * @return {Object} An array of user objects with properly sorted weeklySummaries by due date.
   */
  const formatSummaries = function (results) {
    return results.map((user) => {
      let { weeklySummaries: wS } = user;
      const wSummaries = [null, null, null, null];
      wS = wS.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      wS.forEach((summary) => {
        const week = getTheWeek(summary.dueDate);
        if (week >= 0 && week <= 3) {
          wSummaries[week] = summary;
        }
      });
      return { ...user, weeklySummaries: wSummaries };
    });
  };
  return {
    weeklySummaries,
    formatSummaries,
  };
};
module.exports = reporthelper;
const reporthelperInstance = reporthelper();
console.log('Testing formatSummaries:');
const sampleData1 = [
  {
    weeklySummaries: [
      { dueDate: new Date() },
      { dueDate: new Date(new Date().setDate(new Date().getDate() - 7)) },
      { dueDate: new Date(new Date().setDate(new Date().getDate() - 14)) },
      { dueDate: new Date(new Date().setDate(new Date().getDate() - 21)) },
    ],
  },
];
console.log('Test 1: all weeks present');
console.log(
  JSON.stringify(reporthelperInstance.formatSummaries(sampleData1), null, 2),
);
const sampleData2 = [
  {
    weeklySummaries: [
      { dueDate: new Date() },
      { dueDate: new Date(new Date().setDate(new Date().getDate() - 7)) },
      { dueDate: new Date(new Date().setDate(new Date().getDate() - 21)) },
    ],
  },
];
console.log('Test 2: one week missing');
console.log(
  JSON.stringify(reporthelperInstance.formatSummaries(sampleData2), null, 2),
);
const sampleData3 = [
  {
    weeklySummaries: [
      { dueDate: new Date(new Date().setDate(new Date().getDate() - 14)) },
    ],
  },
];
console.log('Test 3: multiple weeks missing');
console.log(
  JSON.stringify(reporthelperInstance.formatSummaries(sampleData3), null, 2),
);
