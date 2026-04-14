const express = require('express');

const routes = function (badge) {
  const controller = require('../controllers/badgeController')(badge);

  const badgeRouter = express.Router();

<<<<<<< HEAD
  // badgeRouter.get('/badge/awardBadgesTest', controller.awardBadgesTest);
=======
  badgeRouter.post('/badge/awardNewBadges', controller.awardNewBadges);
>>>>>>> 61eff0cf6e3f3cb3da817d052796dad32db32c67

  badgeRouter.route('/badge').get(controller.getAllBadges).post(controller.postBadge);

  badgeRouter.route('/badge/:badgeId').delete(controller.deleteBadge).put(controller.putBadge);

  badgeRouter.route('/badge/assign/:userId').put(controller.assignBadges);

  badgeRouter
    .route('/badge/badgecount/:userId')
    .get(controller.getBadgeCount)
    .put(controller.putBadgecount);

  badgeRouter.route('/badge/badgecount/reset/:userId').put(controller.resetBadgecount);

  return badgeRouter;
};

module.exports = routes;
