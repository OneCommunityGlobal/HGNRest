var express = require('express');
var userProfile = require('../models/userProfile');
var timeentry = require('../models/timeentry');
var ObjectId = require('mongodb').ObjectID;
var moment = require('moment');
var mongoose = require('mongoose');

var dashboardhelper = function () {

  var date = Date.now();

  var rollupYear = moment(date).get('year');
  var rollupMonth = ("0" + (moment(date).get('month') + 1)).slice(-2) + moment(date).get('year');
  var rollupWeek = moment(date).startOf('week').format("MM/DD/YYYY");

  var personaldetails = function (userId) {

    return userProfile.findById(userId, '_id firstName lastName role profilePic badgeCollection');

  };


  var getWeeklyTimeEntries = function (members) {

    var people = [];

    members.myteam.forEach(element => {
      people.push(element._id);

    });

    return timeentry.aggregate([
      {
        $match: {
          personId: { $in: people }, rollupWeek: rollupWeek
        }
      },
      {
        $lookup: {
          from: "userProfiles",
          localField: "personId",
          foreignField: "_id",
          as: "persondata"
        }
      },
      {
        $project: {
          timelogid: "$_id",
          personID: {
            $arrayElemAt: ["$persondata._id", 0]
          },
          personName: {
            $concat: [{
              $arrayElemAt: ["$persondata.firstName", 0]
            }, " ", {
              $arrayElemAt: ["$persondata.lastName", 0]
            }]
          },
          totalSeconds: 1,
          weeklyComittedHours: {
            $arrayElemAt: ["$persondata.weeklyComittedHours", 0]
          },
          isTangible: 1,
          tangibletime: {
            $cond: {
              if: {
                $eq: ["$isTangible", true]
              },
              then: "$totalSeconds",
              else: 0
            }
          },
          intangibletime: {
            $cond: {
              if: {
                $eq: ["$isTangible", false]
              },
              then: "$totalSeconds",
              else: 0
            }
          }

        }
      },
      {
        $group: {
          _id: {
            personId: "$personID",
            personName: "$personName",
            weeklyComittedHours: "$weeklyComittedHours"
          },
          totaltime: {
            $sum: "$totalSeconds"
          },
          totaltangibletime: {
            $sum: "$tangibletime"
          },
          totalintangibletime: {
            $sum: "$intangibletime"
          }
        }
      },
      {
        $project: {
          _id: 0,
          personId: "$_id.personId",
          name: "$_id.personName",
          weeklyComittedHours: "$_id.weeklyComittedHours",
          "totaltime_hrs": { $divide: ["$totaltime", 3600] },
          "totaltangibletime_hrs": { $divide: ["$totaltangibletime", 3600] },
          "totalintangibletime_hrs": { $divide: ["$totalintangibletime", 3600] },
          percentagespentintangible: {
            $cond: [{ $eq: ["$totaltime", 0] }, 0, {
              $multiply: [100, {
                $divide: ["$totaltangibletime", "$totaltime"]
              }]
            }]
          }
        }
      },
      {
        $sort: {
          totaltangibletime_hrs: -1
        }
      }

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
