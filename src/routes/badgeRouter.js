const express = require('express');


const routes = function (badge) {
  const controller = require('../controllers/badgeController')(badge);

  const badgeRouter = express.Router();

  badgeRouter.route('/badge')
    .get(controller.getAllBadges)
    .post(controller.postBadge);

  badgeRouter.route('/badge/assign/:userId')
    .put(controller.assignBadges);

  return badgeRouter;
};


module.exports = routes;
