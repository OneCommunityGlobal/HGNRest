const express = require('express');

const routes = function (badge) {
  const controller = require('../controllers/badgeController')(badge);

  const badgeRouter = express.Router();

  badgeRouter.route('/badge/getAllBadges').get(controller.getAllBadges);

  // badgeRouter.route('/badge/getbadge/:badgeId').get(controller.getBadge);

  // badgeRouter.get('/badge/awardBadgesTest', controller.awardBadgesTest);

  // to update the schema with array of users for every badge
  badgeRouter.route('/badge/updateUsers').put(controller.updateBadgesWithUsers);

  // to update the array of users
  badgeRouter.route('/badge/updateBadgeUsers').put(controller.updateBadgeUsers);

  // to create/post new badge
  badgeRouter.route('/badge/postBadge').get(controller.getAllBadges).post(controller.postBadge);

  badgeRouter.route('/badge/:badgeId').delete(controller.deleteBadge).put(controller.putBadge);

  badgeRouter.route('/badge/deletebadge/:badgeId').delete(controller.deleteBadge);

  badgeRouter.route('/badge/assign/:userId').put(controller.assignBadges);

  // to update the schema with array of users for every badge
  // badgeRouter.route('/badge/updateUsers').put(controller.putBadge);

  // to update the array of users
  // badgeRouter.route('/badge/updateBadgeUsers').put(controller.updateBadgeUsers);

  // console.log('controller.updateBadgeUsers:', controller.updateBadgeUsers);

  badgeRouter
    .route('/badge/badgecount/:userId')
    .get(controller.getBadgeCount)
    .put(controller.putBadgecount);

  badgeRouter.route('/badge/badgecount/reset/:userId').put(controller.resetBadgecount);

  return badgeRouter;
};

module.exports = routes;
