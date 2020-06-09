const moment = require('moment-timezone');
const userProfile = require('../models/userProfile');


const reporthelper = function () {
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
      },
    },
    ]);
  };

  return {
    weeklySummaries,
  };
};

module.exports = reporthelper;
