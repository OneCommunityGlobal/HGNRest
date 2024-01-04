const moment = require('moment-timezone');
const userProfile = require('../models/userProfile');
const myteam = require('../helpers/helperModels/myTeam');

const taskHelper = function () {
  const getTasksForTeams = async function (userId) {
    const userid = mongoose.Types.ObjectId(userId);
    const userById = await userProfile.findOne({ _id: userid , isActive:true}, {role:1,firstName:1, lastName:1, role:1, isVisible:1, weeklycommittedHours:1, weeklySummaries:1})
                    .then((res)=>{ return res;  }).catch((e)=>{});

    if(userById==null) return null;
    const userRole = userById.role;

    const pdtstart = moment()
      .tz('America/Los_Angeles')
      .startOf('week')
      .format('YYYY-MM-DD');
    const pdtend = moment()
      .tz('America/Los_Angeles')
      .endOf('week')
      .format('YYYY-MM-DD');

      let teamMemberIds = [userid]
      let teamMembers = [];

      if(userRole!='Administrator' && userRole!='Owner' && userRole!='Core Team') //Manager , Mentor , Volunteer ... , Show only team members
      {
        
        const teamsResult = await team.find( { "members.userId": { $in: [userid] } }, {members:1} )
          .then((res)=>{ return res; }).catch((e)=>{})

          teamsResult.map((_myTeam)=>{
            _myTeam.members.map((teamMember)=> {
              if(!teamMember.userId.equals(userid))
              teamMemberIds.push( teamMember.userId );
          } )
          })

          teamMembers = await userProfile.find({ _id: { $in: teamMemberIds } , isActive:true },
              {role:1,firstName:1,lastName:1,weeklycommittedHours:1})
            .then((res)=>{ return res;  }).catch((e)=>{})
      }
      else { 
        if(userRole == 'Administrator'){ //All users except Owner and Core Team
          const excludedRoles = ['Core Team', 'Owner'];
          teamMembers = await userProfile.find({ isActive:true , role: { $nin: excludedRoles } },
            {role:1,firstName:1,lastName:1,weeklycommittedHours:1})
          .then((res)=>{ return res;  }).catch((e)=>{})
        }
        else{ //'Core Team', 'Owner' //All users
          teamMembers = await userProfile.find({ isActive:true},
            {role:1,firstName:1,lastName:1,weeklycommittedHours:1})
          .then((res)=>{ return res;  }).catch((e)=>{})
        }  
      }

      teamMemberIds = teamMembers.map(member => member._id);

      const timeEntries = await timeentry.find({
        dateOfWork: {
          $gte: pdtstart,
          $lte: pdtend,
        },
        personId: { $in: teamMemberIds }
      });
  
      let timeEntryByPerson = {}
      timeEntries.map((timeEntry)=>{
          
        let personIdStr = timeEntry.personId.toString();
  
        if(timeEntryByPerson[personIdStr]==null) 
           timeEntryByPerson[personIdStr] = {tangibleSeconds:0,intangibleSeconds:0,totalSeconds:0};
  
        if (timeEntry.isTangible === true) {
          timeEntryByPerson[personIdStr].tangibleSeconds += timeEntry.totalSeconds;
        } 
        timeEntryByPerson[personIdStr].totalSeconds += timeEntry.totalSeconds;
      })

      const teamMemberTasks = await Task.find({"resources.userID" : {$in : teamMemberIds }}, { 'resources.profilePic': 0 })
      .populate( {
        path: 'wbsId',
        select: 'projectId',
      })
      const teamMemberTaskIds = teamMemberTasks.map(task => task._id);
      const teamMemberTaskNotifications = await TaskNotification.find({"taskId" : {$in : teamMemberTaskIds }})

      const taskNotificationByTaskNdUser = []  
      teamMemberTaskNotifications.map(teamMemberTaskNotification => {

        let taskIdStr = teamMemberTaskNotification.taskId.toString();
        let userIdStr = teamMemberTaskNotification.userId.toString();
        let taskNdUserID = taskIdStr+","+userIdStr;

        if(taskNotificationByTaskNdUser[taskNdUserID]) {
          taskNotificationByTaskNdUser[taskNdUserID].push(teamMemberTaskNotification)
        }
        else{
          taskNotificationByTaskNdUser[taskNdUserID] = [teamMemberTaskNotification]
        }

      })
      
      const taskByPerson = [] 
      
      teamMemberTasks.map(teamMemberTask => {

       let projId = teamMemberTask.wbsId?.projectId;
       let _teamMemberTask = {...teamMemberTask._doc}
       _teamMemberTask.projectId = projId;
       let taskIdStr = _teamMemberTask._id.toString();

         teamMemberTask.resources.map(resource => {
            
            let resourceIdStr = resource.userID.toString();
            let taskNdUserID = taskIdStr+","+resourceIdStr;
            _teamMemberTask.taskNotifications = taskNotificationByTaskNdUser[taskNdUserID] || []
            if(taskByPerson[resourceIdStr]) {
              taskByPerson[resourceIdStr].push(_teamMemberTask)
            }
            else{
              taskByPerson[resourceIdStr] = [_teamMemberTask]
            }
        })
      })

      
    let teamMemberTasksData = [];
    teamMembers.map((teamMember)=>{
        let obj = {
          personId : teamMember._id,
          role : teamMember.role,
          name : teamMember.firstName + ' ' + teamMember.lastName,
          weeklycommittedHours : teamMember.weeklycommittedHours,
          totaltangibletime_hrs : ((timeEntryByPerson[teamMember._id.toString()]?.tangibleSeconds / 3600) || 0),
          totaltime_hrs : ((timeEntryByPerson[teamMember._id.toString()]?.totalSeconds / 3600) || 0),
          tasks : taskByPerson[teamMember._id.toString()] || []
        }
        teamMemberTasksData.push(obj);
    })


    return teamMemberTasksData;
      

    // return myteam.aggregate([
    //   {
    //     $match: {
    //       _id: userId,
    //     },
    //   },
    //   {
    //     $unwind: '$myteam',
    //   },
    //   {
    //     $project: {
    //       _id: 0,
    //       personId: '$myteam._id',
    //       name: '$myteam.fullName',
    //       role: 1,
    //     },
    //   },
    //   // have personId, name, role
    //   {
    //     $lookup: {
    //       from: 'userProfiles',
    //       localField: 'personId',
    //       foreignField: '_id',
    //       as: 'persondata',
    //     },
    //   },
    //   {
    //     $match: {
    //       // dashboard tasks user roles hierarchy
    //       $or: [
    //         {
    //           role: { $in: ['Owner', 'Core Team'] },
    //         },
    //         {
    //           $and: [
    //             {
    //               role: 'Administrator',
    //             },
    //             { 'persondata.0.role': { $nin: ['Owner', 'Administrator'] } },
    //           ],
    //         },
    //         {
    //           $and: [
    //             {
    //               role: { $in: ['Manager', 'Mentor'] },
    //             },
    //             {
    //               'persondata.0.role': {
    //                 $nin: ['Manager', 'Mentor', 'Core Team', 'Administrator', 'Owner'],
    //               },
    //             },
    //           ],
    //         },
    //         { 'persondata.0._id': userId },
    //         { 'persondata.0.role': 'Volunteer' },
    //         { 'persondata.0.isVisible': true },
    //       ],
    //     },
    //   },
    //   {
    //     $project: {
    //       personId: 1,
    //       name: 1,
    //       weeklycommittedHours: {
    //         $sum: [
    //           {
    //             $arrayElemAt: ['$persondata.weeklycommittedHours', 0],
    //           },
    //           {
    //             $ifNull: [{ $arrayElemAt: ['$persondata.missedHours', 0] }, 0],
    //           },
    //         ],
    //       },
    //       role: 1,
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: 'timeEntries',
    //       localField: 'personId',
    //       foreignField: 'personId',
    //       as: 'timeEntryData',
    //     },
    //   },
    //   {
    //     $project: {
    //       personId: 1,
    //       name: 1,
    //       weeklycommittedHours: 1,
    //       timeEntryData: {
    //         $filter: {
    //           input: '$timeEntryData',
    //           as: 'timeentry',
    //           cond: {
    //             $and: [
    //               {
    //                 $gte: ['$$timeentry.dateOfWork', pdtstart],
    //               },
    //               {
    //                 $lte: ['$$timeentry.dateOfWork', pdtend],
    //               },
    //             ],
    //           },
    //         },
    //       },
    //       role: 1,
    //     },
    //   },
    //   {
    //     $unwind: {
    //       path: '$timeEntryData',
    //       preserveNullAndEmptyArrays: true,
    //     },
    //   },
    //   {
    //     $project: {
    //       personId: 1,
    //       name: 1,
    //       weeklycommittedHours: 1,
    //       totalSeconds: {
    //         $cond: [
    //           {
    //             $gte: ['$timeEntryData.totalSeconds', 0],
    //           },
    //           '$timeEntryData.totalSeconds',
    //           0,
    //         ],
    //       },
    //       isTangible: {
    //         $cond: [
    //           {
    //             $gte: ['$timeEntryData.totalSeconds', 0],
    //           },
    //           '$timeEntryData.isTangible',
    //           false,
    //         ],
    //       },
    //       role: 1,
    //     },
    //   },
    //   {
    //     $addFields: {
    //       tangibletime: {
    //         $cond: [
    //           {
    //             $eq: ['$isTangible', true],
    //           },
    //           '$totalSeconds',
    //           0,
    //         ],
    //       },
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: {
    //         personId: '$personId',
    //         weeklycommittedHours: '$weeklycommittedHours',
    //         name: '$name',
    //         role: '$role',
    //       },
    //       totalSeconds: {
    //         $sum: '$totalSeconds',
    //       },
    //       tangibletime: {
    //         $sum: '$tangibletime',
    //       },
    //     },
    //   },
    //   {
    //     $project: {
    //       _id: 0,
    //       personId: '$_id.personId',
    //       name: '$_id.name',
    //       weeklycommittedHours: '$_id.weeklycommittedHours',
    //       totaltime_hrs: {
    //         $divide: ['$totalSeconds', 3600],
    //       },
    //       totaltangibletime_hrs: {
    //         $divide: ['$tangibletime', 3600],
    //       },
    //       role: '$_id.role',
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: 'tasks',
    //       localField: 'personId',
    //       foreignField: 'resources.userID',
    //       as: 'tasks',
    //     },
    //   },
    //   {
    //     $project: {
    //       tasks: {
    //         resources: {
    //           profilePic: 0,
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $unwind: {
    //       path: '$tasks',
    //       preserveNullAndEmptyArrays: true,
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: 'wbs',
    //       localField: 'tasks.wbsId',
    //       foreignField: '_id',
    //       as: 'projectId',
    //     },
    //   },
    //   {
    //     $addFields: {
    //       'tasks.projectId': {
    //         $cond: [
    //           { $ne: ['$projectId', []] },
    //           { $arrayElemAt: ['$projectId', 0] },
    //           '$tasks.projectId',
    //         ],
    //       },
    //     },
    //   },
    //   {
    //     $project: {
    //       projectId: 0,
    //       tasks: {
    //         projectId: {
    //           _id: 0,
    //           isActive: 0,
    //           modifiedDatetime: 0,
    //           wbsName: 0,
    //           createdDatetime: 0,
    //           __v: 0,
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       'tasks.projectId': '$tasks.projectId.projectId',
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: 'taskNotifications',
    //       localField: 'tasks._id',
    //       foreignField: 'taskId',
    //       as: 'tasks.taskNotifications',
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: '$personId',
    //       tasks: {
    //         $push: '$tasks',
    //       },
    //       data: {
    //         $first: '$$ROOT',
    //       },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       'data.tasks': {
    //         $filter: {
    //           input: '$tasks',
    //           as: 'task',
    //           cond: { $ne: ['$$task', {}] },
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $replaceRoot: {
    //       newRoot: '$data',
    //     },
    //   },
    // ]);
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
                  {
                    $in: ['$$timeentry.entryType', ['default', null]],
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
  const getUserProfileFirstAndLastName = function (userId) {
    return userProfile.findById(userId).then((results) => {
      if (!results) {
        return ' ';
      }
      return `${results.firstName} ${results.lastName}`;
    });
  };
  return {
    getTasksForTeams,
    getTasksForSingleUser,
    getUserProfileFirstAndLastName,
  };
};

module.exports = taskHelper;
