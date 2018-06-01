var express = require('express');
var userProfile = require('../models/userProfile');
var timeentry = require('../models/timeentry');
var ObjectId = require('mongodb').ObjectID;
var moment = require('moment-timezone');
var mongoose = require('mongoose');
var myTeam = require('../helpers/helperModels/myTeam');
var userProfile = require('../models/userProfile');

var dashboardhelper = function () {

  var date = Date.now();



  var personaldetails = function (userId) {

    return userProfile.findById(userId, '_id firstName lastName role profilePic badgeCollection');

  };


  var getLeaderboard = function (userId, ) {



    var userid = mongoose.Types.ObjectId(userId);
    var pdtstart = moment().tz("America/Los_Angeles").startOf("isoWeek").format();
    var pdtend = moment().tz("America/Los_Angeles").endOf("isoWeek").format();
    return myTeam.aggregate([

      { $match: { _id: userid } },
      { $unwind: "$myteam" },
      { $project: { _id: 0, personId: "$myteam._id", name: "$myteam.fullName" } },
      { $lookup: { from: "userProfiles", localField: "personId", foreignField: "_id", as: "persondata" } },
      { $project: { personId: 1, name: 1, weeklyComittedHours: { $arrayElemAt: ["$persondata.weeklyComittedHours", 0] } } },
      { $lookup: { from: "timeEntries", localField: "personId", foreignField: "personId", as: "timeEntryData" } },
      {
        $project: {
          personId: 1, name: 1, weeklyComittedHours: 1, timeEntryData: {
            $filter: {
              input: "$timeEntryData", as: "timeentry", cond: { $and: [{ $gte: ["$$timeentry.dateofWork", new Date(pdtstart)] }, { $lte: ["$$timeentry.dateofWork", new Date(pdtend)] }] }
            }
          }
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

  var laborthismonth = function (userId, startDate, endDate) {
    let fromdate = moment(startDate).utc().format();
    let todate = moment(endDate).utc().format();

    return timeentry.aggregate([{
      $match: {
        personId: userId,
        isTangible: true,
        dateofWork: { "$gte": new Date(fromdate), "$lte": new Date(todate) }

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

  var laborthisweek = function (userId, startDate, endDate) {
    let fromdate = moment(startDate).utc().format();
    let todate = moment(endDate).utc().format();

    return userProfile.aggregate([
      { $match: { _id: userId } },
      { $project: { weeklyComittedHours: 1, _id: 1 } },
      { $lookup: { from: "timeEntries", localField: "_id", foreignField: "personId", as: "timeEntryData" } },
      {
        $project: {
          weeklyComittedHours: 1, timeEntryData: {
            $filter: {
              input: "$timeEntryData", as: "timeentry", cond: { $and: [{ $eq: ["$$timeentry.isTangible", true] }, { $gte: ["$$timeentry.dateofWork", new Date(fromdate)] }, { $lte: ["$$timeentry.dateofWork", new Date(todate)] }] }
            }
          }
        }
      },
      { $unwind: { path: "$timeEntryData", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { _id: "$_id", weeklyComittedHours: "$weeklyComittedHours" }, effort: { $sum: "$timeEntryData.totalSeconds" } } },
      { $project: { _id: 0, weeklyComittedHours: "$_id.weeklyComittedHours", timeSpent_hrs: { $divide: ["$effort", 3600] } } }


    ]);

  };


  return {
    personaldetails: personaldetails,
    getLeaderboard: getLeaderboard,
    laborthismonth: laborthismonth,
    laborthisweek: laborthisweek

  };

};


module.exports = dashboardhelper;
