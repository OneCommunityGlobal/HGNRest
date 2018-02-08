var express = require('express');
var userProfile = require('../models/userProfile');
var timeentry = require('../models/timeentry');
var ObjectId = require('mongodb').ObjectID;
var moment = require('moment');
var mongoose = require('mongoose');

var dashboardhelper = function () {

  var date = Date.now();

  var rollupYear = moment(date).get('year');
  var rollupMonth = ("0" + moment(date).get('month') + 1).slice(-2) + moment(date).get('year');
  var rollupWeek = moment(date).startOf('week').format("MM/DD/YYYY");

  var personaldetails = function (userId) {

    return userProfile.findById(userId, '_id firstName lastName role weeklycommitted teamId profilePic badgeCollection');

  };




  var getTimeEnteries = function (members) {

    var people = [];

    members.forEach(element => {
      people.push(element._id);

    });

    return timeentry.aggregate([{
        $match: {
          $and: [{
              personId: {
                $in: people
              }
            },
            {
              rollupYear: rollupYear.toString()
            },
            {
              rollupMonth: rollupMonth
            },
            {
              rollupWeek: rollupWeek
            }
          ]
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
          }

        }
      },
      {
        $group: {
          _id: {
            personId: "$personID",
            personName: "$personName",
            weeklyComittedHours: "weeklyComittedHours"
          },
          totaltime: {
            $sum: "$totalSeconds"
          },
          totaltangibletime: {
            $sum: "$tangibletime"
          }
        }
      },
      {
        $project: {
          _id: 0,
          personId: "$_id.personId",
          name: "$_id.personName",
          "totaltime_hrs":{$divide:[ "$totaltime", 3600]},
          "totaltangibletime_hrs": {$divide: ["$totaltangibletime", 3600]},
          percentagespentintangible: {
            $multiply: [100, {
              $divide: ["$totaltangibletime", "$totaltime"]
            }]
          }
        }
      },
      {
        $sort: {
          percentagespentintangible: -1
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
          from: "allProjects",
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
          "timeSpent_hrs": {$divide: ["$labor",3600]}
        }

      }
    ]);

  };

  var laborthisweek = function (userId) {
    return timeentry.aggregate([{
        $match: {
          $and: [{
            personId: userId
          }, {
            rollupWeek: rollupWeek
          }]
        }
      },
      {
        $group: {
          _id: {
            userId: "$personId"
          },
          labor: {
            $sum: "$totalSeconds"
          }
        }
      },
      {
        $project: {
          _id: 0,
          "timeSpent_hrs": {$divide: ["$labor",3600]}
        }
      }
    ]);

  };


  return {
    personaldetails: personaldetails,
   
    getTimeEnteries: getTimeEnteries,
    laborthismonth: laborthismonth,
    laborthisweek: laborthisweek

  };

};


module.exports = dashboardhelper;
