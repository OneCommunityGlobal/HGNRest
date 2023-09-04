const moment = require('moment-timezone');
const userProfile = require('../models/userProfile');
const myteam = require('../helpers/helperModels/myTeam');

const taskHelper = function () {
  const getTasksForTeams = function (userId) {
    const pdtstart = moment()
      .tz('America/Los_Angeles')
      .startOf('week')
      .format('YYYY-MM-DD');
    const pdtend = moment()
      .tz('America/Los_Angeles')
      .endOf('week')
      .format('YYYY-MM-DD');
    return myteam.aggregate([
      {
        $match: {
          _id: userId,
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
          role: 1,
        },
      },
      // have personId, name, role
      {
        $lookup: {
          from: 'userProfiles',
          localField: 'personId',
          foreignField: '_id',
          as: 'persondata',
        },
      },
      {
        $match: {
          $or: [
            {
              role: {
                $in: [
                  'Core Team',
                  'Administrator',
                  'Owner',
                ],
              },
            },
            { 'persondata.0._id': userId },
            { 'persondata.0.role': 'Volunteer' },
            { 'persondata.0.isVisible': true },
          ],
        },
      },
      {
        $project: {
          personId: 1,
          name: 1,
          weeklycommittedHours: {
            $sum: [
              {
              $arrayElemAt: ['$persondata.weeklycommittedHours', 0],
              },
              {
              $ifNull: [{ $arrayElemAt: ['$persondata.missedHours', 0] }, 0],
              },
            ],
          },
          role: 1,
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
          role: 1,
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
          role: 1,
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
        },
      },
      {
        $project: {
          _id: 0,
          personId: '$_id.personId',
          name: '$_id.name',
          weeklycommittedHours: '$_id.weeklycommittedHours',
          totaltime_hrs: {
            $divide: ['$totalSeconds', 3600],
          },
          totaltangibletime_hrs: {
            $divide: ['$tangibletime', 3600],
          },
          role: '$_id.role',
        },
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'personId',
          foreignField: 'resources.userID',
          as: 'tasks',
        },
      },
      {
        $project: {
          tasks: {
            resources: {
              profilePic: 0,
            },
          },
        },
      },
      {
        $unwind: {
          path: '$tasks',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'wbs',
          localField: 'tasks.wbsId',
          foreignField: '_id',
          as: 'projectId',
        },
      },
      {
        $addFields: {
          'tasks.projectId': {
            $cond: [
              { $ne: ['$projectId', []] },
              { $arrayElemAt: ['$projectId', 0] },
              '$tasks.projectId',
            ],
          },
        },
      },
      {
        $project: {
          projectId: 0,
          tasks: {
            projectId: {
              _id: 0,
              isActive: 0,
              modifiedDatetime: 0,
              wbsName: 0,
              createdDatetime: 0,
              __v: 0,
            },
          },
        },
      },
      {
        $addFields: {
          'tasks.projectId': '$tasks.projectId.projectId',
        },
      },
      {
        $lookup: {
          from: 'taskNotifications',
          localField: 'tasks._id',
          foreignField: 'taskId',
          as: 'tasks.taskNotifications',
        },
      },
      {
        $group: {
          _id: '$personId',
          tasks: {
            $push: '$tasks',
          },
          data: {
            $first: '$$ROOT',
          },
        },
      },
      {
        $addFields: {
          'data.tasks': {
            $filter: {
              input: '$tasks',
              as: 'task',
              cond: { $ne: ['$$task', {}] },
            },
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: '$data',
        },
      },
    ]);
  };
  const getTasksForSingleUser = function (userId) {
    const pdtstart = moment()
      .tz('America/Los_Angeles')
      .startOf('week')
      .format('YYYY-MM-DD');
    const pdtend = moment()
      .tz('America/Los_Angeles')
      .endOf('week')
      .format('YYYY-MM-DD');
    return userProfile.aggregate([
      {
        $match: {
          _id: userId,
        },
      },
      {
        $project: {
          personId: '$_id',
          role: '$role',
          name: {
            $concat: [
            '$firstName',
            ' ',
            '$lastName',
            ],
          },
          weeklycommittedHours: {
            $sum: [
              '$weeklycommittedHours',
              {
                $ifNull: ['$missedHours', 0],
              },
            ],
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
          name: 1,
          weeklycommittedHours: 1,
          role: 1,
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
        },
      },
      {
        $project: {
          _id: 0,
          personId: '$_id.personId',
          name: '$_id.name',
          weeklycommittedHours: '$_id.weeklycommittedHours',
          role: '$_id.role',
          totaltime_hrs: {
            $divide: ['$totalSeconds', 3600],
          },
          totaltangibletime_hrs: {
            $divide: ['$tangibletime', 3600],
          },
        },
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'personId',
          foreignField: 'resources.userID',
          as: 'tasks',
        },
      },
      {
        $project: {
          tasks: {
            resources: {
            profilePic: 0,
            },
          },
        },
      },
      {
        $unwind: {
          path: '$tasks',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'wbs',
          localField: 'tasks.wbsId',
          foreignField: '_id',
          as: 'projectId',
        },
      },
      {
        $addFields: {
          'tasks.projectId': {
            $cond: [
            { $ne: ['$projectId', []] },
            { $arrayElemAt: ['$projectId', 0] },
            '$tasks.projectId',
            ],
          },
        },
      },
      {
        $project: {
          projectId: 0,
          tasks: {
            projectId: {
            _id: 0,
            isActive: 0,
            modifiedDatetime: 0,
            wbsName: 0,
            createdDatetime: 0,
            __v: 0,
            },
          },
        },
      },
      {
        $addFields: {
          'tasks.projectId': '$tasks.projectId.projectId',
        },
      },
      {
        $lookup: {
          from: 'taskNotifications',
          localField: 'tasks._id',
          foreignField: 'taskId',
          as: 'tasks.taskNotifications',
        },
      },
      {
        $group: {
          _id: '$personId',
          tasks: { $push: '$tasks' },
          data: {
            $first: '$$ROOT',
          },
        },
      },
      {
        $addFields: {
          'data.tasks': {
            $filter: {
            input: '$tasks',
            as: 'task',
            cond: { $ne: ['$$task', {}] },
            },
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: '$data',
        },
      },
    ]);
  };
  return {
    getTasksForTeams,
    getTasksForSingleUser,
  };
};

module.exports = taskHelper;
