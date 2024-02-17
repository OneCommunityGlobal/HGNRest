const express = require('express');


const routes = function () {
    const controller = require('../controllers/BadgeCountController')();

    const badgeCountRouter = express.Router();

    badgeCountRouter.route('/badgecount/:userId')
        .get(controller.getBadgeCount)
        .put(controller.putBadgecount);

    return badgeCountRouter;
};


module.exports = routes;
