const moment = require('moment-timezone');
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const timeentry = require('../models/timeentry');
const myTeam = require('../helpers/helperModels/myTeam');

const dashboardhelper = function () {
  const personaldetails = function (userId) {
    return userProfile.findById(
      userId,
      '_id firstName lastName role profilePic badgeCollection',
    );
  };

  const getOrgData = async function () {
    const pdtstart = moment()
      .tz('America/Los_Angeles')
      .startOf('week')
      .format('YYYY-MM-DD');
    const pdtend = moment()
      .tz('America/Los_Angeles')
      .endOf('week')
      .format('YYYY-MM-DD');

    const output = await userProfile.aggregate([
      {
        $match: {
          isActive: true,
          weeklycommittedHours: {
            $gte: 1,
          },
          role: {
            $ne: 'Mentor',
          },
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
          weeklycommittedHours: 1,
          role: 1,
          timeEntryData: {
            $filter: {
              input: '$timeEntryData',
              as: 'timeentry',
              cond: {
                $and: [
                  {
                    $gte: ['$$timeentry.dateOfWork', pdtstart],
                  },
                  {
                    $lte: ['$$timeentry.dateOfWork', pdtend],
                  },
                ],
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
          weeklycommittedHours: 1,
          totalSeconds: {
            $cond: [
              {
                $gte: ['$timeEntryData.totalSeconds', 0],
              },
              '$timeEntryData.totalSeconds',
              0,
            ],
          },
          isTangible: {
            $cond: [
              {
                $gte: ['$timeEntryData.totalSeconds', 0],
              },
              '$timeEntryData.isTangible',
              false,
            ],
          },
        },
      },
      {
        $addFields: {
          tangibletime: {
            $cond: [
              {
                $eq: ['$isTangible', true],
              },
              '$totalSeconds',
              0,
            ],
          },
          intangibletime: {
            $cond: [
              {
                $eq: ['$isTangible', false],
              },
              '$totalSeconds',
              0,
            ],
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
          totalweeklycommittedHours: {
            $sum: '$weeklycommittedHours',
          },
        },
      },
      {
        $project: {
          _id: 0,
          memberCount: '$member_count',
          totalweeklycommittedHours: '$totalweeklycommittedHours',
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
            $cond: [
              {
                $eq: ['$totalSeconds', 0],
              },
              0,
              {
                $multiply: [
                  {
                    $divide: ['$tangibletime', '$totalSeconds'],
                  },
                  100,
                ],
              },
            ],
          },
        },
      },
    ]);

    // This is a temporary band aid. I can't figure out why, but intangible time entries
    // somehow increment the total weekly committted hours across all users. ???
    const USERS = await userProfile.find({ isActive: true, role: { $ne: 'Mentor' }, weeklycommittedHours: { $gt: 0 } });
    let TOTAL_committED_HOURS = 0;
    let MEMBER_COUNT = 0;
    USERS.forEach((user) => {
      TOTAL_committED_HOURS += user.weeklycommittedHours;
      MEMBER_COUNT += 1;
    });

    output[0].totalweeklycommittedHours = TOTAL_committED_HOURS;
    output[0].memberCount = MEMBER_COUNT;

    return output;
  };

  const getLeaderboard = function (userId) {
    const userid = mongoose.Types.ObjectId(userId);
    const pdtstart = moment()
      .tz('America/Los_Angeles')
      .startOf('week')
      .format('YYYY-MM-DD');
    const pdtend = moment()
      .tz('America/Los_Angeles')
      .endOf('week')
      .format('YYYY-MM-DD');
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
          role: '$myteam.role',
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
          role: '$persondata.role',
          weeklycommittedHours: {
            $arrayElemAt: ['$persondata.weeklycommittedHours', 0],
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
          role: 1,
          weeklycommittedHours: 1,
          timeEntryData: {
            $filter: {
              input: '$timeEntryData',
              as: 'timeentry',
              cond: {
                $and: [
                  {
                    $gte: ['$$timeentry.dateOfWork', pdtstart],
                  },
                  {
                    $lte: ['$$timeentry.dateOfWork', pdtend],
                  },
                ],
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
          role: 1,
          weeklycommittedHours: 1,
          totalSeconds: {
            $cond: [
              {
                $gte: ['$timeEntryData.totalSeconds', 0],
              },
              '$timeEntryData.totalSeconds',
              0,
            ],
          },
          isTangible: {
            $cond: [
              {
                $gte: ['$timeEntryData.totalSeconds', 0],
              },
              '$timeEntryData.isTangible',
              false,
            ],
          },
        },
      },
      {
        $addFields: {
          tangibletime: {
            $cond: [
              {
                $eq: ['$isTangible', true],
              },
              '$totalSeconds',
              0,
            ],
          },
          intangibletime: {
            $cond: [
              {
                $eq: ['$isTangible', false],
              },
              '$totalSeconds',
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            personId: '$personId',
            weeklycommittedHours: '$weeklycommittedHours',
            name: '$name',
            role: '$role',
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
          role: '$_id.role',
          weeklycommittedHours: '$_id.weeklycommittedHours',
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
            $cond: [
              {
                $eq: ['$totalSeconds', 0],
              },
              0,
              {
                $multiply: [
                  {
                    $divide: ['$tangibletime', '$totalSeconds'],
                  },
                  100,
                ],
              },
            ],
          },
        },
      },
      {
        $sort: {
          totaltangibletime_hrs: -1,
          name: 1,
          role: 1,
        },
      },
    ]);
  };

  /**
   * Calculates values used by the leaderboard on the front end.
   * @param {*} userId
   * @returns
   */
  const getUserLaborData = async function (userId) {
    try {
      const pdtStart = moment()
        .tz('America/Los_Angeles')
        .startOf('week')
        .format('YYYY-MM-DD');

      const pdtEnd = moment()
        .tz('America/Los_Angeles')
        .endOf('week')
        .format('YYYY-MM-DD');

      const user = await userProfile.findById({
        _id: userId,
      });

      const timeEntries = await timeentry.find({
        dateOfWork: {
          $gte: pdtStart,
          $lte: pdtEnd,
        },
        personId: userId,
      });

      let tangibleSeconds = 0;
      let intangibleSeconds = 0;

      timeEntries.forEach((timeEntry) => {
        if (timeEntry.isTangible === true) {
          tangibleSeconds += timeEntry.totalSeconds;
        } else {
          intangibleSeconds += timeEntry.totalSeconds;
        }
      });

      return [
        {
          personId: userId,
          name: `${user.firstName} ${user.lastName}`,
          totaltime_hrs: (tangibleSeconds + intangibleSeconds) / 3600,
          totaltangibletime_hrs: tangibleSeconds / 3600,
          totalintangibletime_hrs: intangibleSeconds / 3600,
          percentagespentintangible:
            (intangibleSeconds / tangibleSeconds) * 100,
        },
      ];
    } catch (err) {
      return [
        {
          personId: 'error',
          name: 'Error Error',
          totaltime_hrs: 0,
          totaltangibletime_hrs: 0,
          totalintangibletime_hrs: 0,
          percentagespentintangible: 0,
        },
      ];
    }
  };

  const laborthismonth = function (userId, startDate, endDate) {
    const fromdate = moment(startDate).format('YYYY-MM-DD');
    const todate = moment(endDate).format('YYYY-MM-DD');

    return timeentry.aggregate([
      {
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
            $ifNull: [
              {
                $arrayElemAt: ['$project.projectName', 0],
              },
              'Undefined',
            ],
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

    return userProfile.aggregate([
      {
        $match: {
          _id: userId,
        },
      },
      {
        $project: {
          weeklycommittedHours: 1,
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
          weeklycommittedHours: 1,
          timeEntryData: {
            $filter: {
              input: '$timeEntryData',
              as: 'timeentry',
              cond: {
                $and: [
                  {
                    $eq: ['$$timeentry.isTangible', true],
                  },
                  {
                    $gte: ['$$timeentry.dateOfWork', fromdate],
                  },
                  {
                    $lte: ['$$timeentry.dateOfWork', todate],
                  },
                ],
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
            weeklycommittedHours: '$weeklycommittedHours',
          },
          effort: {
            $sum: '$timeEntryData.totalSeconds',
          },
        },
      },
      {
        $project: {
          _id: 0,
          weeklycommittedHours: '$_id.weeklycommittedHours',
          timeSpent_hrs: {
            $divide: ['$effort', 3600],
          },
        },
      },
    ]);
  };

  const laborThisWeekByCategory = function (userId, startDate, endDate) {
    const fromdate = moment(startDate).format('YYYY-MM-DD');
    const todate = moment(endDate).format('YYYY-MM-DD');

    return userProfile.aggregate([
      {
        $match: {
          _id: userId,
        },
      },
      {
        $project: {
          weeklycommittedHours: 1,
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
          weeklycommittedHours: 1,
          timeEntryData: {
            $filter: {
              input: '$timeEntryData',
              as: 'timeentry',
              cond: {
                $and: [
                  {
                    $eq: ['$$timeentry.isTangible', true],
                  },
                  {
                    $gte: ['$$timeentry.dateOfWork', fromdate],
                  },
                  {
                    $lte: ['$$timeentry.dateOfWork', todate],
                  },
                ],
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
          _id: '$timeEntryData.projectId',
          effort: {
            $sum: '$timeEntryData.totalSeconds',
          },
        },
      },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: '_id',
          as: 'project',
        },
      },
      {
        $unwind: {
          path: '$project',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$project.category',
          effort: {
            $sum: '$effort',
          },
        },
      },
      {
        $project: {
          _id: 1,
          timeSpent_hrs: {
            $divide: ['$effort', 3600],
          },
        },
      },
    ]);
  };

  return {
    personaldetails,
    getUserLaborData,
    getLeaderboard,
    getOrgData,
    laborthismonth,
    laborthisweek,
    laborThisWeekByCategory,
  };
};

module.exports = dashboardhelper;
