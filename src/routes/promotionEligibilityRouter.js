// src/routes/promotionEligibilityRouter.js
const express = require('express');

// Modify the 'routes' function to accept 'PromotionEligibility' as well
const routes = function (userProfile, timeEntry, task, PromotionEligibility) {
  // Pass the new model to your controller
  const controller = require('../controllers/promotionEligibilityController')(
    userProfile,
    timeEntry,
    task,
    PromotionEligibility,
  );
  const router = express.Router();

  router.route('/promotion-eligibility').get(controller.getPromotionEligibilityData);

  router.route('/promote-members').post(controller.promoteMembers);

  return router;
};

module.exports = routes;
