var express = require('express');
var userProfile = require('../models/userProfile');
var timeentry = require('../models/timeentry');
var ObjectId = require('mongodb').ObjectID;
var moment = require('moment-timezone');
var mongoose = require('mongoose');
var myTeam = require('../helpers/helperModels/myTeam');

var dashboardhelper = function () {

  var date = Date.now();

  var rollupYear = moment(date).get('year');
  var rollupMonth = ("0" + (moment(date).get('month') + 1)).slice(-2) + moment(date).get('year');
  var rollupWeek = moment(date).startOf('isoWeek').format("MM/DD/YYYY");

  var personaldetails = function (userId) {

    return userProfile.findById(userId, '_id firstName lastName role profilePic badgeCollection');

  };


  var getWeeklyTimeEntries = function (userId) {

    var userid = mongoose.Types.ObjectId(userId);
    var pdtweek = moment().tz("America/Los_Angeles").startOf("isoWeek").format("MM/DD/YYYY");
    return myTeam.aggregate([

      { $match: { _id: userid } },
      { $unwind: "$myteam" },
      { $project: { _id: 0, personId: "$myteam._id", name: "$myteam.fullName" } },
      { $lookup: { from: "userProfiles", localField: "personId", foreignField: "_id", as: "persondata" } },
      { $project: { personId: 1, name: 1, weeklyComittedHours: { $arrayElemAt: ["$persondata.weeklyComittedHours", 0] } } },
      { $lookup: { from: "timeEntries", localField: "personId", foreignField: "personId", as: "timeEntryData" } },
      {
        $project: {
          personId: 1, name: 1, weeklyComittedHours: 1, timeEntryData: { $filter: { input: "$timeEntryData", as: "thisweekString", cond: { $eq: ["$$thisweekString.rollupWeek", pdtweek] } } }
        }
      },
      { $unwind: { path: "$timeEntryData", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          personId: 1, name: 1, weeklyComittedHours: 1,
          totalSeconds: { $cond: [{ $gte: ["$timeEntryData.totalSeconds", 0] }, "$timeEntryData.totalSeconds", 0] },
          isTangible: { $cond: [{ $gte: ["$timeEntryData.totalSeconds", 0] }, "$timeEntryData.isTangible", false] }
        }
      },
      {
        $addFields: {
          tangibletime: { $cond: [{ $eq: ["$isTangible", true] }, "$totalSeconds", 0] },
          intangibletime: { $cond: [{ $eq: ["$isTangible", false] }, "$totalSeconds", 0] }
        }
      },
      {
        $group: { _id: { personId: "$personId", weeklyComittedHours: "$weeklyComittedHours", name: "$name" }, totalSeconds: { $sum: "$totalSeconds" }, tangibletime: { $sum: "$tangibletime" }, intangibletime: { $sum: "$intangibletime" } }
      },
      {
        $project: {
          _id: 0, personId: "$_id.personId", name: "$_id.name", weeklyComittedHours: "$_id.weeklyComittedHours", totaltime_hrs: { $divide: ["$totalSeconds", 3600] },
          totaltangibletime_hrs: { $divide: ["$tangibletime", 3600] }, totalintangibletime_hrs: { $divide: ["$intangibletime", 3600] },
          percentagespentintangible: { $cond: [{ $eq: ["$totalSeconds", 0] }, 0, { $multiply: [{ $divide: ["$tangibletime", "$totalSeconds"] }, 100] }] }
        }
      },
      { $sort: { totaltangibletime_hrs: -1, name: 1 } }
    ]);



  };

  var laborthismonth = function (userId) {
    return timeentry.aggregate([{
      $match: {
        $and: [{
          personId: userId
        }, {
          rollupMonth: rollupMonth
        }]
      }
    },
    {
      $group: {
        _id: {
          projectId: "$projectId"
        },
        labor: {
          $sum: "$totalSeconds"
        }
      }
    },
    {
      $lookup: {
        from: "projects",
        localField: "_id.projectId",
        foreignField: "_id",
        as: "project"
      }
    },
    {
      $project: {
        _id: 0,
        projectName: {
          $ifNull: [{
            $arrayElemAt: ["$project.projectName", 0]
          }, "Undefined"]
        },
        "timeSpent_hrs": { $divide: ["$labor", 3600] }
      }

    }
    ]);

  };

  var laborthisweek = function (userId) {
    return timeentry.aggregate([{
      $match: {
        personId: userId,
        isTangible: true,
        rollupWeek: rollupWeek

      }
    },
    {
      $group: {
        _id: "$personId",
        labor: {
          $sum: "$totalSeconds"
        }
      }
    },
    {
      $lookup: {
        from: "userProfiles",
        localField: "_id",
        foreignField: "_id",
        as: "persondata"
      }
    },
    {
      $project: {
        _id: 0,
        "timeSpent_hrs": { $divide: ["$labor", 3600] },
        "weeklyComittedHours": { $arrayElemAt: ["$persondata.weeklyComittedHours", 0] }

      }
    }
    ]);

  };


  return {
    personaldetails: personaldetails,
    getWeeklyTimeEntries: getWeeklyTimeEntries,
    laborthismonth: laborthismonth,
    laborthisweek: laborthisweek

  };

};


module.exports = dashboardhelper;
