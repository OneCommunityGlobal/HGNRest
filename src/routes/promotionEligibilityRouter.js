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
  PromotionPrEntry,
) {
  const controller = require('../controllers/promotionEligibilityController')(
    userProfile,
    timeEntry,
    task,
    PromotionEligibility,
    ReviewerGroup,
    Team,
    HgnFormResponses,
    PromotionPrEntry,
  );
  const reviewerGroups = require('../controllers/reviewerGroupController')(ReviewerGroup);
  const router = express.Router();

  router.route('/promotion-eligibility').post(controller.getPromotionEligibilityData);

  router.route('/promotion-eligibility/:reviewerId/prs-needed').patch(controller.updatePrsNeeded);

  // "+ Add New" column. Reads are POST for the same requestor-in-body reason
  // as everything else on this router.
  router.route('/promotion-eligibility/pr-ratings').post(controller.getPrRatings);

  router.route('/promotion-eligibility/:reviewerId/pr-entries').post(controller.getPrEntries);

  // Same read for a list of reviewers, so a table does not make one request per
  // row. Two path segments where the single reviewer route has three, so the
  // literal cannot be captured as a `:reviewerId`.
  router.route('/promotion-eligibility/pr-entries').post(controller.getPrEntriesForReviewers);

  router.route('/promotion-eligibility/:reviewerId/pr-entries/new').post(controller.addPrEntry);

  router
    .route('/promotion-eligibility/:reviewerId/pr-entries/import')
    .post(controller.importPrEntriesFromSummary);

  router
    .route('/promotion-eligibility/pr-entries/:entryId/rating')
    .patch(controller.updatePrEntryRating);

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
