let userProfile = require('../models/userProfile');
let TimeEntry = require('../models/timeentry');
let dashboardhelper = require('../helpers/dashboardhelper')();
let userhelper = require('../helpers/userhelper')();
let mongoose = require('mongoose');


let dashboardcontroller = function () {

  let output;
  let dashboarddata = function (req, res) {

    let teamid = "";
    let details = {};

    let userId = mongoose.Types.ObjectId(req.params.userId);


    let snapshot = dashboardhelper.personaldetails(userId);

    snapshot.then(results => { res.send(results).status(200) });



  };

  var monthlydata = function (req, res) {
    let userId = mongoose.Types.ObjectId(req.params.userId);
    let laborthismonth = dashboardhelper.laborthismonth(userId);
    laborthismonth.then(results => { res.send(results).status(200) });


  };

  var weeklydata = function (req, res) {
    let userId = mongoose.Types.ObjectId(req.params.userId);
    let laborthisweek = dashboardhelper.laborthisweek(userId);
    laborthisweek.then(results => { res.send(results).status(200) });

  };


  var leaderboarddata = function (req, res) {
    let userId = mongoose.Types.ObjectId(req.params.userId);
    let leaderboard =
      dashboardhelper.personaldetails(userId)
        .then(userhelper.getTeamMembers)
        .then(dashboardhelper.getTimeEnteries);

    leaderboard.then(results => { res.send(results).status(200) });

  };




  return {

    dashboarddata: dashboarddata,
    monthlydata: monthlydata,
    weeklydata: weeklydata,
    leaderboarddata: leaderboarddata

  };
};

module.exports = dashboardcontroller;
