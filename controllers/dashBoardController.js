var userProfile = require('../models/userProfile');
var TimeEntry = require('../models/timeentry');
var dashboardhelper = require('../helpers/dashboardhelper')();
var mongoose = require('mongoose');
var dashboardcontroller = function () {

  var output ;
  var dashboarddata = function (req, res) {

    var teamid = "";
    
    var userid = req.params.userId; /* TODO: Get user id so that details can be retrrived */

    dashboardhelper.personaldetails(userid)
      .then(dashboardhelper.getTeamMembers)
      .then(dashboardhelper.getTimeEnteries)
    //  .then(dashboardhelper.sortTimeEnteries)
      .then( results => {res.send(results).status(200); } )
      .catch(error => {res.send(error).status(404);});
  };


  return {
    //personaldetails: _personaldetails,
    dashboarddata: dashboarddata


  };


};

module.exports = dashboardcontroller;
