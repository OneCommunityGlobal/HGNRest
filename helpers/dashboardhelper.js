
var express = require('express');
var userProfile = require('../models/userProfile');
var timeentry = require('../models/timeentry');
var ObjectId = require('mongodb').ObjectID;

var dashboardhelper = function () {

  var _personaldetails =  function (userid) {
       
    return userProfile.findById(userid); 
    
  };


  var _getTeamMembers = function (userdetails) {

    /*
    1. Get all the teams of the person.
    2. Get all the active team members.
    3. Get all the time emterries for above people.
    4. Sort them for leaderboard data.        
    */
    var teamid =userdetails.teamId;  
  
    return userProfile.find({teamId : {$in : [teamid]}});
  };

  var _getTimeEnteries = function(){}; 

  return {
    personaldetails: _personaldetails,
    getTeamMembers: _getTeamMembers,
    getTimeEnteries:_getTimeEnteries

  }

};


module.exports = dashboardhelper;
