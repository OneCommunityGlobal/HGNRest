let userProfile = require('../models/userProfile');
let TimeEntry = require('../models/timeentry');
let dashboardhelper = require('../helpers/dashboardhelper')();
let userhelper = require('../helpers/userhelper')();
let mongoose = require('mongoose');


let dashboardcontroller = function () {

  let output ;
  let dashboarddata = function (req, res) {

    let teamid = "";
    let details = {};
    
    let userId = mongoose.Types.ObjectId(req.params.userId);
    

    let snapshot = dashboardhelper.personaldetails(userId);    

    let leaderboard =  
    dashboardhelper.personaldetails(userId)
    .then(userhelper.getTeamMembers)
    .then(dashboardhelper.getTimeEnteries);

    let laborthismonth = dashboardhelper.laborthismonth(userId);
    let laborthisweek = dashboardhelper.laborthisweek(userId);

    let dashboardPromises = [snapshot,  laborthismonth, laborthisweek, leaderboard];

    Promise.all(dashboardPromises)
    .then(function(results)
    {
      let dashboard = {};
      dashboard.userSnapshot = results[dashboardPromises.indexOf(snapshot)];    
     dashboard.laborthismonth = results[dashboardPromises.indexOf(laborthismonth)];
     dashboard.laborthisweek = results[dashboardPromises.indexOf(laborthisweek)];
     dashboard.leaderboard = results[dashboardPromises.indexOf(leaderboard)];
      res.status(200).send(dashboard);
    }
  )
  .catch(error => 
    {res.status(400).send(error);});

        
 
  };


  return {
    
    dashboarddata: dashboarddata

  };
};

module.exports = dashboardcontroller;
