const express = require('express');

const route = function () {
  const controller = require('../controllers/dashBoardController')();


  const Dashboardrouter = express.Router();

  Dashboardrouter.route('/dashboard/:userId')
    .get(controller.dashboarddata);

  Dashboardrouter.route('/dashboard/monthlydata/:userId/:fromDate/:toDate')
    .get(controller.monthlydata);

  Dashboardrouter.route('/dashboard/weeklydata/:userId/:fromDate/:toDate')
    .get(controller.weeklydata);

  Dashboardrouter.route('/dashboard/leaderboard/:userId')
    .get(controller.leaderboarddata);

  Dashboardrouter.route('/dashboard/leaderboard/org/data')
    .get(controller.orgData);

  return Dashboardrouter;
};

module.exports = route;
