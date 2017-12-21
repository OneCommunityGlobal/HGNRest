var express = require('express');
var userProfile = require('../models/userProfile');
var timeentry = require('../models/timeentry');
var ObjectId = require('mongodb').ObjectID;
var moment = require('moment');

var dashboardhelper = function () {

  var personaldetails =  function (userid) {

          
    return userProfile.findById(userid); 
    
  };


  var getTeamMembers = function (userdetails) {

    /*
    1. Get all the teams of the person.
    2. Get all the active team members.
    3. Get all the time emterries for above people.
    4. Sort them for leaderboard data.        
    
    */

    var teamid = userdetails.teamId;
  
    return userProfile
    .find({$and : [{teamId : {$in : teamid}},{isActive: true}]})
    .select({_id: 1, firstName: 1, lastName:1});
  };

  var getTimeEnteries = function(members){

    var people= [];

    members.forEach(element => {
      people.push(element._id);
      
    });

    var date = Date.now();

    var rollupYear = moment(date).get('year');
    var rollupMonth   =("0"+ moment(date).get('month')+1).slice(-2) + moment(date).get('year');
    var rollupWeek = moment(date).startOf('week').format("MM/DD/YYYY");

     return timeentry.aggregate([
        {$match : {$and :[
          {personId : {$in : people}}, 
          {rollupYear: rollupYear.toString()}, 
          {rollupMonth: rollupMonth}, 
          {rollupWeek: rollupWeek}
          ] }},
          {$lookup : {
            from: "userProfiles",
            localField: "personId",
            foreignField: "_id",
            as: "persondata"
           }},
          {$project : {            
            timelogid : "$_id",
            personID : {$arrayElemAt:["$persondata._id", 0]},
            personName : {$concat : [{$arrayElemAt:["$persondata.firstName", 0]}, " ",{$arrayElemAt:["$persondata.lastName", 0]}]},
            totalSeconds:1 ,
            weeklyComittedHours: {$arrayElemAt:["$persondata.weeklyComittedHours", 0]},
            isTangible:1,
            tangibletime : {$cond : {if : { $eq:["$isTangible", true] },  then: "$totalSeconds", else: 0}}
       
           }},
          {$group : {
            _id : {
             personId:  "$personID",
             personName : "$personName",
             weeklyComittedHours: "weeklyComittedHours"
            },
            totaltime: {$sum: "$totalSeconds"},
            totaltangibletime:{$sum: "$tangibletime"}
         }},
         {
           $project : {
            _id:0,
            personId : "$_id.personId",
            name: "$_id.personName",
            totaltime: "$totaltime",
            totaltangibletime : "$totaltangibletime",
            percentagespentintangible : {$multiply : [100, {$divide: ["$totaltangibletime", "$totaltime"]}]}
           }
         },
         {$sort : {percentagespentintangible :  -1}}
        
      ]);    
  }; 


  return {
    personaldetails: personaldetails,
    getTeamMembers: getTeamMembers,
    getTimeEnteries:getTimeEnteries,
   };

};


module.exports = dashboardhelper;
