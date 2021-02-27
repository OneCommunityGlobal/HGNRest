const mongoose = require('mongoose');
const dashboardhelper = require('../helpers/dashboardhelper')();

const dashboardcontroller = function () {
  const dashboarddata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);

    const snapshot = dashboardhelper.personaldetails(userId);

    snapshot.then((results) => { res.send(results).status(200); });
  };

  const monthlydata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const laborthismonth = dashboardhelper.laborthismonth(userId, req.params.fromDate, req.params.toDate);
    laborthismonth.then((results) => {
      if (!results || results.length === 0) {
        const emptyresult = [{
          projectName: '',
          timeSpent_hrs: 0,
        }];
        res.status(200).send(emptyresult);
        return;
      }
      res.status(200).send(results);
    });
  };

  const weeklydata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const laborthisweek = dashboardhelper.laborthisweek(userId, req.params.fromDate, req.params.toDate);
    laborthisweek.then((results) => { res.send(results).status(200); });
  };


  const leaderboarddata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const leaderboard = dashboardhelper.getLeaderboard(userId);

    leaderboard.then((results) => { res.status(200).send(results); })
      .catch(error => res.status(400).send(error));
  };

  const orgData = function (req, res) {
    const fullOrgData = dashboardhelper.getOrgData();

    fullOrgData.then((results) => { res.status(200).send(results[0]); })
      .catch(error => res.status(400).send(error));
  };

  return {
    dashboarddata,
    monthlydata,
    weeklydata,
    leaderboarddata,
    orgData,
  };
};

module.exports = dashboardcontroller;
