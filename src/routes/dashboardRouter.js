const express = require('express');

const route = function () {
  const controller = require('../controllers/dashBoardController')();

  const Dashboardrouter = express.Router();

  Dashboardrouter.route('/dashboard/aiPrompt')
    .get(controller.getAIPrompt)
    .put(controller.updateAIPrompt);

  Dashboardrouter.route('/dashboard/aiPrompt/copied/:userId')
    .get(controller.getPromptCopiedDate)
    .put(controller.updateCopiedPrompt);

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

  Dashboardrouter.route('/dashboard/leaderboard/trophyIcon/:userId/:trophyFollowedUp')
    .post(controller.postTrophyIcon);

  Dashboardrouter.route('/dashboard/suggestionoption/:userId')
    .get(controller.getSuggestionOption);

  Dashboardrouter.route('/dashboard/bugreport/:userId')
    .post(controller.sendBugReport);

  Dashboardrouter.route('/dashboard/suggestionoption/:userId')
    .post(controller.editSuggestionOption);

  Dashboardrouter.route('/dashboard/makesuggestion/:userId')
    .post(controller.sendMakeSuggestion);

  return Dashboardrouter;
};

module.exports = route;
