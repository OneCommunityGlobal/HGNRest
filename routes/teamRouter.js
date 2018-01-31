var express = require('express');

var router = function(team){
    var controller = require('../controllers/teamController')(team);

    var teamRouter = express.Router();

    teamRouter.route('/team')
    .get(controller.getAllTeams)
    .post(controller.postTeam);

    teamRouter.route('/team/:teamId')
    .get(controller.getTeamById);

    return teamRouter;

};

module.exports = router;