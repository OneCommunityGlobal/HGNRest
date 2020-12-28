const express = require('express');


const routes = function (badge) {
  const controller = require('../controllers/badgeController')(badge);

  const badgeRouter = express.Router();

  badgeRouter.route('/badge/:userId')
    .get(controller.getAllBadges);

  return badgeRouter;
};


module.exports = routes;
