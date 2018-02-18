var express = require('express');

var route = function(TimeEntry, userProfile){

    var controller = require('../controllers/dashBoardController')();


    var Dashboardrouter = express.Router();

    Dashboardrouter.route('/dashboard/:userId')
    .get(controller.dashboarddata);

    Dashboardrouter.route('/dashboard/monthlydata/:userId')
    .get(controller.monthlydata);

    Dashboardrouter.route('/dashboard/weeklydata/:userId')
    .get(controller.weeklydata);

    return Dashboardrouter;

}

module.exports = route;