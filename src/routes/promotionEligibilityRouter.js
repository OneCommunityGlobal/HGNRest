// src/routes/promotionEligibilityRouter.js
const express = require('express');

const routes = function (
  userProfile,
  timeEntry,
  task,
  PromotionEligibility,
  ReviewerGroup,
  Team,
  HgnFormResponses,
) {
  const controller = require('../controllers/promotionEligibilityController')(
    userProfile,
    timeEntry,
    task,
    PromotionEligibility,
    ReviewerGroup,
    Team,
    HgnFormResponses,
  );
  const reviewerGroups = require('../controllers/reviewerGroupController')(ReviewerGroup);
  const router = express.Router();

  router.route('/promotion-eligibility').post(controller.getPromotionEligibilityData);

  router.route('/promotion-eligibility/:reviewerId/prs-needed').patch(controller.updatePrsNeeded);

  // Preview is its own route rather than a flag on /promote-members, so there
  // is no way for a caller to promote people by accident while asking what
  // would happen.
  router.route('/promote-members/preview').post(controller.previewPromotions);

  router.route('/promote-members').post(controller.promoteMembers);

  // Reads are POST for the same reason the dashboard read is: the permission
  // check reads `req.body.requestor`, and a GET carries no body. That was fixed
  // once already in BE PR 2201, so it is not re-litigated here. It is also why
  // creating a group posts to /new rather than to the collection path.
  router.route('/reviewer-groups').post(reviewerGroups.getReviewerGroups);

  router.route('/reviewer-groups/new').post(reviewerGroups.createReviewerGroup);

  router.route('/reviewer-groups/:groupKey').patch(reviewerGroups.updateReviewerGroup);

  return router;
};

module.exports = routes;
