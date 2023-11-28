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

  Dashboardrouter.route('/dashboard/suggestionoption/:userId')
    .get(controller.getSuggestionOption);

  Dashboardrouter.route('/dashboard/bugreport/:userId')
    .post(controller.sendBugReport);

  Dashboardrouter.route('/dashboard/suggestionoption/:userId')
    .post(controller.editSuggestionOption);

  Dashboardrouter.route('/dashboard/makesuggestion/:userId')
    .post(controller.sendMakeSuggestion);

  Dashboardrouter.route('/dashboard/leaderboard/trophyIcon/:userId/:trophyFollowedUp')
    .post(controller.postTrophyIcon);

  return Dashboardrouter;
};

module.exports = route;
