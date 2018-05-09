var express = require('express');

var route = function (TimeEntry, userProfile) {

    var controller = require('../controllers/dashBoardController')();


    var Dashboardrouter = express.Router();

    Dashboardrouter.route('/dashboard/:userId')
        .get(controller.dashboarddata);

    Dashboardrouter.route('/dashboard/monthlydata/:userId/:fromDate/:toDate')
        .get(controller.monthlydata);

    Dashboardrouter.route('/dashboard/weeklydata/:userId/:fromDate/:toDate')
        .get(controller.weeklydata);

    Dashboardrouter.route('/dashboard/leaderboard/:userId')
        .get(controller.leaderboarddata);

    return Dashboardrouter;

}

module.exports = route;