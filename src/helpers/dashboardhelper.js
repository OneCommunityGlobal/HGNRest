const moment = require('moment-timezone');
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const timeentry = require('../models/timeentry');
const myTeam = require('../helpers/helperModels/myTeam');


const dashboardhelper = function () {
  const personaldetails = function (userId) {
    return userProfile.findById(userId, '_id firstName lastName role profilePic badgeCollection');
  };

  const getOrgData = function () {
    const pdtstart = moment().tz('America/Los_Angeles').startOf('week').format('YYYY-MM-DD');
    const pdtend = moment().tz('America/Los_Angeles').endOf('week').format('YYYY-MM-DD');
    return userProfile.aggregate([
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
          as: 'timeEntryData',
        },
      },
      {
        $project: {
          personId: 1,
          name: 1,
          weeklyComittedHours: 1,
          timeEntryData: {
            $filter: {
              input: '$timeEntryData',
              as: 'timeentry',
              cond: {
                $and: [{
                  $gte: ['$$timeentry.dateOfWork', pdtstart],
                }, {
                  $lte: ['$$timeentry.dateOfWork', pdtend],
                }],
              },
            },
          },
        },
      },
      {
        $unwind: {
          path: '$timeEntryData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          personId: 1,
          weeklyComittedHours: 1,
          totalSeconds: {
            $cond: [{
              $gte: ['$timeEntryData.totalSeconds', 0],
            }, '$timeEntryData.totalSeconds', 0],
          },
          isTangible: {
            $cond: [{
              $gte: ['$timeEntryData.totalSeconds', 0],
            }, '$timeEntryData.isTangible', false],
          },
        },
      },
      {
        $addFields: {
          tangibletime: {
            $cond: [{
              $eq: ['$isTangible', true],
            }, '$totalSeconds', 0],
          },
          intangibletime: {
            $cond: [{
              $eq: ['$isTangible', false],
            }, '$totalSeconds', 0],
          },
        },
      },
      {
        $group: {
          _id: 0,
          member_count: {
            $sum: 1,
          },
          totalSeconds: {
            $sum: '$totalSeconds',
          },
          tangibletime: {
            $sum: '$tangibletime',
          },
          intangibletime: {
            $sum: '$intangibletime',
          },
          totalWeeklyComittedHours: {
            $sum: '$weeklyComittedHours',
          },
        },
      },
      {
        $project: {
          _id: 0,
          member_count: '$member_count',
          totalWeeklyComittedHours: '$totalWeeklyComittedHours',
          totaltime_hrs: {
            $divide: ['$totalSeconds', 3600],
          },
          totaltangibletime_hrs: {
            $divide: ['$tangibletime', 3600],
          },
          totalintangibletime_hrs: {
            $divide: ['$intangibletime', 3600],
          },
          percentagespentintangible: {
            $cond: [{
              $eq: ['$totalSeconds', 0],
            }, 0, {
              $multiply: [{
                $divide: ['$tangibletime', '$totalSeconds'],
              }, 100],
            }],
          },
        },
      },
    ]);
  };

  const getLeaderboard = function (userId) {
    const userid = mongoose.Types.ObjectId(userId);
    const pdtstart = moment().tz('America/Los_Angeles').startOf('week').format('YYYY-MM-DD');
    const pdtend = moment().tz('America/Los_Angeles').endOf('week').format('YYYY-MM-DD');
    return myTeam.aggregate([

      {
        $match: {
          _id: userid,
        },
      },
      {
        $unwind: '$myteam',
      },
      {
        $project: {
          _id: 0,
          personId: '$myteam._id',
          name: '$myteam.fullName',
        },
      },
      {
        $lookup: {
          from: 'userProfiles',
          localField: 'personId',
          foreignField: '_id',
          as: 'persondata',
        },
      },
      {
        $project: {
          personId: 1,
          name: 1,
          weeklyComittedHours: {
            $arrayElemAt: ['$persondata.weeklyComittedHours', 0],
          },
        },
      },
      {
        $lookup: {
          from: 'timeEntries',
          localField: 'personId',
          foreignField: 'personId',
          as: 'timeEntryData',
        },
      },
      {
        $project: {
          personId: 1,
          name: 1,
          weeklyComittedHours: 1,
          timeEntryData: {
            $filter: {
              input: '$timeEntryData',
              as: 'timeentry',
              cond: {
                $and: [{
                  $gte: ['$$timeentry.dateOfWork', pdtstart],
                }, {
                  $lte: ['$$timeentry.dateOfWork', pdtend],
                }],
              },
            },
          },
        },
      },
      {
        $unwind: {
          path: '$timeEntryData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          personId: 1,
          name: 1,
          weeklyComittedHours: 1,
          totalSeconds: {
            $cond: [{
              $gte: ['$timeEntryData.totalSeconds', 0],
            }, '$timeEntryData.totalSeconds', 0],
          },
          isTangible: {
            $cond: [{
              $gte: ['$timeEntryData.totalSeconds', 0],
            }, '$timeEntryData.isTangible', false],
          },
        },
      },
      {
        $addFields: {
          tangibletime: {
            $cond: [{
              $eq: ['$isTangible', true],
            }, '$totalSeconds', 0],
          },
          intangibletime: {
            $cond: [{
              $eq: ['$isTangible', false],
            }, '$totalSeconds', 0],
          },
        },
      },
      {
        $group: {
          _id: {
            personId: '$personId',
            weeklyComittedHours: '$weeklyComittedHours',
            name: '$name',
          },
          totalSeconds: {
            $sum: '$totalSeconds',
          },
          tangibletime: {
            $sum: '$tangibletime',
          },
          intangibletime: {
            $sum: '$intangibletime',
          },
        },
      },
      {
        $project: {
          _id: 0,
          personId: '$_id.personId',
          name: '$_id.name',
          weeklyComittedHours: '$_id.weeklyComittedHours',
          totaltime_hrs: {
            $divide: ['$totalSeconds', 3600],
          },
          totaltangibletime_hrs: {
            $divide: ['$tangibletime', 3600],
          },
          totalintangibletime_hrs: {
            $divide: ['$intangibletime', 3600],
          },
          percentagespentintangible: {
            $cond: [{
              $eq: ['$totalSeconds', 0],
            }, 0, {
              $multiply: [{
                $divide: ['$tangibletime', '$totalSeconds'],
              }, 100],
            }],
          },
        },
      },
      {
        $sort: {
          totaltangibletime_hrs: -1,
          name: 1,
        },
      },
    ]);
  };

  const laborthismonth = function (userId, startDate, endDate) {
    const fromdate = moment(startDate).format('YYYY-MM-DD');
    const todate = moment(endDate).format('YYYY-MM-DD');

    return timeentry.aggregate([{
      $match: {
        personId: userId,
        isTangible: true,
        dateOfWork: {
          $gte: fromdate,
          $lte: todate,
        },

      },
    },
    {
      $group: {
        _id: {
          projectId: '$projectId',
        },
        labor: {
          $sum: '$totalSeconds',
        },
      },
    },
    {
      $lookup: {
        from: 'projects',
        localField: '_id.projectId',
        foreignField: '_id',
        as: 'project',
      },
    },
    {
      $project: {
        _id: 0,
        projectName: {
          $ifNull: [{
            $arrayElemAt: ['$project.projectName', 0],
          }, 'Undefined'],
        },
        timeSpent_hrs: {
          $divide: ['$labor', 3600],
        },
      },

    },
    ]);
  };

  const laborthisweek = function (userId, startDate, endDate) {
    const fromdate = moment(startDate).format('YYYY-MM-DD');
    const todate = moment(endDate).format('YYYY-MM-DD');

    return userProfile.aggregate([{
      $match: {
        _id: userId,
      },
    },
    {
      $project: {
        weeklyComittedHours: 1,
        _id: 1,
      },
    },
    {
      $lookup: {
        from: 'timeEntries',
        localField: '_id',
        foreignField: 'personId',
        as: 'timeEntryData',
      },
    },
    {
      $project: {
        weeklyComittedHours: 1,
        timeEntryData: {
          $filter: {
            input: '$timeEntryData',
            as: 'timeentry',
            cond: {
              $and: [{
                $eq: ['$$timeentry.isTangible', true],
              }, {
                $gte: ['$$timeentry.dateOfWork', fromdate],
              }, {
                $lte: ['$$timeentry.dateOfWork', todate],
              }],
            },
          },
        },
      },
    },
    {
      $unwind: {
        path: '$timeEntryData',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: {
          _id: '$_id',
          weeklyComittedHours: '$weeklyComittedHours',
        },
        effort: {
          $sum: '$timeEntryData.totalSeconds',
        },
      },
    },
    {
      $project: {
        _id: 0,
        weeklyComittedHours: '$_id.weeklyComittedHours',
        timeSpent_hrs: {
          $divide: ['$effort', 3600],
        },
      },
    },


    ]);
  };


  return {
    personaldetails,
    getLeaderboard,
    getOrgData,
    laborthismonth,
    laborthisweek,

  };
};


module.exports = dashboardhelper;
