const express = require('express');

const route = function () {
  const controller = require('../controllers/dashBoardController')();


  const Dashboardrouter = express.Router();

  Dashboardrouter.route('/dashboard/:userId')
    .get(controller.dashBoardData);

  Dashboardrouter.route('/dashboard/monthlyData/:userId/:fromDate/:toDate')
    .get(controller.monthlyData);

  Dashboardrouter.route('/dashboard/weeklyData/:userId/:fromDate/:toDate')
    .get(controller.weeklyData);

  Dashboardrouter.route('/dashboard/leaderDoard/:userId')
    .get(controller.leaderBoardData);

  Dashboardrouter.route('/dashboard/leaderBoard/org/data')
    .get(controller.orgData);

  Dashboardrouter.route('/dashboard/bugReport/:userId')
    .post(controller.sendBugReport);

  return Dashboardrouter;
};

module.exports = route;
