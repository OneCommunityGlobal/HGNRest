const express = require('express');


const routes = function (badge) {
  const controller = require('../controllers/badgeController')(badge);

  const badgeRouter = express.Router();

  badgeRouter.route('/badge')
    .get(controller.getAllBadges)
    .post(controller.postBadge);

  badgeRouter.route('/badge/:badgeId')
    .delete(controller.deleteBadge)
    .put(controller.putBadge);

  badgeRouter.route('/badge/assign/:userId')
    .put(controller.assignBadges);

  badgeRouter.route('/badge/badgecount/:userId')
    .get(controller.getBadgeCount)
    .put(controller.putBadgecount);

  return badgeRouter;
};


module.exports = routes;
