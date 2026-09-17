const express = require('express');

const routes = function (badge) {
  const controller = require('../controllers/badgeController')(badge);

  const badgeRouter = express.Router();

  badgeRouter.route('/badge/getAllBadges').get(controller.getAllBadges);

  badgeRouter.post('/badge/awardNewBadges', controller.awardNewBadges);

  // to update the schema with array of users for every badge
  badgeRouter.route('/badge/updateUsers').put(controller.updateBadgesWithUsers);

  // to update the array of users
  badgeRouter.route('/badge/updateBadgeUsers').put(controller.updateBadgeUsers);

  // to create/post new badge
  badgeRouter.route('/badge/postBadge').post(controller.postBadge);

  badgeRouter.route('/badge/:badgeId').delete(controller.deleteBadge).put(controller.putBadge);

  badgeRouter.route('/badge/deletebadge/:badgeId').delete(controller.deleteBadge);

  badgeRouter.route('/badge/assign/:userId').put(controller.assignBadges);

  badgeRouter
    .route('/badge/badgecount/:userId')
    .get(controller.getBadgeCount)
    .put(controller.putBadgecount);

  badgeRouter.route('/badge/badgecount/reset/:userId').put(controller.resetBadgecount);

  return badgeRouter;
};

module.exports = routes;
