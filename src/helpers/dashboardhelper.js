const moment = require('moment-timezone');
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const timeEntry = require('../models/timeEntry');
const myTeam = require('./helperModels/myTeam');

const dashboardHelper = function () {
  const personalDetails = function (userId) {
    return userProfile.findById(
      userId,
      '_id firstName lastName role profilePic badgeCollection',
    );
  };

  const getOrgData = async function () {
    const pdtStart = moment()
      .tz('America/Los_Angeles')
      .startOf('week')
      .format('YYYY-MM-DD');
    const pdtEnd = moment()
      .tz('America/Los_Angeles')
      .endOf('week')
      .format('YYYY-MM-DD');

    const output = await userProfile.aggregate([
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
          weeklyCommittedHours: 1,
          timeEntryData: {
            $filter: {
              input: '$timeEntryData',
              as: 'timeEntry',
              cond: {
                $and: [
                  {
                    $gte: ['$$timeEntry.dateOfWork', pdtStart],
                  },
                  {
                    $lte: ['$$timeEntry.dateOfWork', pdtEnd],
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
          weeklyCommittedHours: 1,
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
          tangibleTime: {
            $cond: [
              {
                $eq: ['$isTangible', true],
              },
              '$totalSeconds',
              0,
            ],
          },
          intangibleTime: {
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
          tangibleTime: {
            $sum: '$tangibleTime',
          },
          intangibleTime: {
            $sum: '$intangibleTime',
          },
          totalWeeklyCommittedHours: {
            $sum: '$weeklyCommittedHours',
          },
        },
      },
      {
        $project: {
          _id: 0,
          memberCount: '$member_count',
          totalWeeklyCommittedHours: '$totalWeeklyCommittedHours',
          totalTimeHrs: {
            $divide: ['$totalSeconds', 3600],
          },
          totalTangibleTimeHrs: {
            $divide: ['$tangibleTime', 3600],
          },
          totalIntangibleTimeHrs: {
            $divide: ['$intangibleTime', 3600],
          },
          percentageSpentIntangible: {
            $cond: [
              {
                $eq: ['$totalSeconds', 0],
              },
              0,
              {
                $multiply: [
                  {
                    $divide: ['$tangibleTime', '$totalSeconds'],
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
    // somehow increment the total weekly committed hours across all users. ???
    const USERS = await userProfile.find({ isActive: true });
    let totalCommittedHours = 0;
    let MEMBER_COUNT = 0;
    USERS.forEach((user) => {
      totalCommittedHours += user.weeklyCommittedHours;
      MEMBER_COUNT += 1;
    });

    output[0].totalWeeklyCommittedHours = totalCommittedHours;
    output[0].memberCount = MEMBER_COUNT;

    return output;
  };

  const getLeaderBoard = function (userId) {
    const id = mongoose.Types.ObjectId(userId);
    const pdtStart = moment()
      .tz('America/Los_Angeles')
      .startOf('week')
      .format('YYYY-MM-DD');
    const pdtEnd = moment()
      .tz('America/Los_Angeles')
      .endOf('week')
      .format('YYYY-MM-DD');
    return myTeam.aggregate([
      {
        $match: {
          _id: id,
        },
      },
      {
        $unwind: '$myTeam',
      },
      {
        $project: {
          _id: 0,
          personId: '$myTeam._id',
          name: '$myTeam.fullName',
        },
      },
      {
        $lookup: {
          from: 'userProfiles',
          localField: 'personId',
          foreignField: '_id',
          as: 'personData',
        },
      },
      {
        $project: {
          personId: 1,
          name: 1,
          weeklyCommittedHours: {
            $arrayElemAt: ['$personData.weeklyCommittedHours', 0],
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
          weeklyCommittedHours: 1,
          timeEntryData: {
            $filter: {
              input: '$timeEntryData',
              as: 'timeEntry',
              cond: {
                $and: [
                  {
                    $gte: ['$$timeEntry.dateOfWork', pdtStart],
                  },
                  {
                    $lte: ['$$timeEntry.dateOfWork', pdtEnd],
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
          weeklyCommittedHours: 1,
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
          tangibleTime: {
            $cond: [
              {
                $eq: ['$isTangible', true],
              },
              '$totalSeconds',
              0,
            ],
          },
          intangibleTime: {
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
            weeklyCommittedHours: '$weeklyCommittedHours',
            name: '$name',
          },
          totalSeconds: {
            $sum: '$totalSeconds',
          },
          tangibleTime: {
            $sum: '$tangibleTime',
          },
          intangibleTime: {
            $sum: '$intangibleTime',
          },
        },
      },
      {
        $project: {
          _id: 0,
          personId: '$_id.personId',
          name: '$_id.name',
          weeklyCommittedHours: '$_id.weeklyCommittedHours',
          totalTimeHrs: {
            $divide: ['$totalSeconds', 3600],
          },
          totalTangibleTimeHrs: {
            $divide: ['$tangibleTime', 3600],
          },
          totalIntangibleTimeHrs: {
            $divide: ['$intangibleTime', 3600],
          },
          percentageSpentIntangible: {
            $cond: [
              {
                $eq: ['$totalSeconds', 0],
              },
              0,
              {
                $multiply: [
                  {
                    $divide: ['$tangibleTime', '$totalSeconds'],
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
          totalTangibleTimeHrs: -1,
          name: 1,
        },
      },
    ]);
  };

  /**
   * Calculates values used by the leaderBoard on the front end.
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

      const timeEntries = await timeEntry.find({
        dateOfWork: {
          $gte: pdtStart,
          $lte: pdtEnd,
        },
        personId: userId,
      });

      let tangibleSeconds = 0;
      let intangibleSeconds = 0;

      timeEntries.forEach((tEntry) => {
        if (tEntry.isTangible === true) {
          tangibleSeconds += tEntry.totalSeconds;
        } else {
          intangibleSeconds += tEntry.totalSeconds;
        }
      });

      return [
        {
          personId: userId,
          name: `${user.firstName} ${user.lastName}`,
          totalTimeHrs: (tangibleSeconds + intangibleSeconds) / 3600,
          totalTangibleTimeHrs: tangibleSeconds / 3600,
          totalIntangibleTimeHrs: intangibleSeconds / 3600,
          percentageSpentIntangible: (intangibleSeconds / tangibleSeconds) * 100,
        },
      ];
    } catch (err) {
      return [
        {
          personId: 'error',
          name: 'Error Error',
          totalTimeHrs: 0,
          totalTangibleTimeHrs: 0,
          totalIntangibleTimeHrs: 0,
          percentageSpentIntangible: 0,
        },
      ];
    }
  };

  const laborThisMonth = function (userId, startDate, endDate) {
    const fromDate = moment(startDate).format('YYYY-MM-DD');
    const toDate = moment(endDate).format('YYYY-MM-DD');

    return timeEntry.aggregate([
      {
        $match: {
          personId: userId,
          isTangible: true,
          dateOfWork: {
            $gte: fromDate,
            $lte: toDate,
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

  const LaborThisWeek = function (userId, startDate, endDate) {
    const fromDate = moment(startDate).format('YYYY-MM-DD');
    const toDate = moment(endDate).format('YYYY-MM-DD');

    return userProfile.aggregate([
      {
        $match: {
          _id: userId,
        },
      },
      {
        $project: {
          weeklyCommittedHours: 1,
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
          weeklyCommittedHours: 1,
          timeEntryData: {
            $filter: {
              input: '$timeEntryData',
              as: 'timeEntry',
              cond: {
                $and: [
                  {
                    $eq: ['$$timeEntry.isTangible', true],
                  },
                  {
                    $gte: ['$$timeEntry.dateOfWork', fromDate],
                  },
                  {
                    $lte: ['$$timeEntry.dateOfWork', toDate],
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
            weeklyCommittedHours: '$weeklyCommittedHours',
          },
          effort: {
            $sum: '$timeEntryData.totalSeconds',
          },
        },
      },
      {
        $project: {
          _id: 0,
          weeklyCommittedHours: '$_id.weeklyCommittedHours',
          timeSpent_hrs: {
            $divide: ['$effort', 3600],
          },
        },
      },
    ]);
  };

  const LaborThisWeekByCategory = function (userId, startDate, endDate) {
    const fromDate = moment(startDate).format('YYYY-MM-DD');
    const toDate = moment(endDate).format('YYYY-MM-DD');

    return userProfile.aggregate([
      {
        $match: {
          _id: userId,
        },
      },
      {
        $project: {
          weeklyCommittedHours: 1,
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
          weeklyCommittedHours: 1,
          timeEntryData: {
            $filter: {
              input: '$timeEntryData',
              as: 'timeEntry',
              cond: {
                $and: [
                  {
                    $eq: ['$$timeEntry.isTangible', true],
                  },
                  {
                    $gte: ['$$timeEntry.dateOfWork', fromDate],
                  },
                  {
                    $lte: ['$$timeEntry.dateOfWork', toDate],
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
    personalDetails,
    getUserLaborData,
    getLeaderBoard,
    getOrgData,
    laborThisMonth,
    LaborThisWeek,
    LaborThisWeekByCategory,
  };
};

module.exports = dashboardHelper;
