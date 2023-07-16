const express = require('express');

const route = function () {
  const controller = require('../controllers/dashBoardController')();


  const Dashboardrouter = express.Router();

  Dashboardrouter.route('/dashboard')
    .get(controller.getDashBoardData);

  Dashboardrouter.route('/dashboard/:userId')
    .put(controller.updateDashboardData);

  Dashboardrouter.route('/dashboard/:userId')
    .get(controller.dashboarduserdata);

  Dashboardrouter.route('/dashboard/monthlydata/:userId/:fromDate/:toDate')
    .get(controller.monthlydata);

  Dashboardrouter.route('/dashboard/weeklydata/:userId/:fromDate/:toDate')
    .get(controller.weeklydata);

  Dashboardrouter.route('/dashboard/leaderboard/:userId')
    .get(controller.leaderboarddata);

  Dashboardrouter.route('/dashboard/leaderboard/org/data')
    .get(controller.orgData);

  Dashboardrouter.route('/dashboard/bugreport/:userId')
    .post(controller.sendBugReport);

  return Dashboardrouter;
};

module.exports = route;
