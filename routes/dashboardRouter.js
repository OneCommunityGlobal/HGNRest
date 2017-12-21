var express = require('express');

var route = function(TimeEntry, userProfile){

    var controller = require('../controllers/dashBoardController')();


    var Dashboardrouter = express.Router();

    Dashboardrouter.route('/dashboard1/:userId')
    .get(controller.dashboarddata);

    return Dashboardrouter;

}

module.exports = route;