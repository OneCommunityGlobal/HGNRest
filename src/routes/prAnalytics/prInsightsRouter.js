const express = require('express');
const routes = function () {
  const prInsightsRouter = express.Router();
  const controller = require('../../controllers/prAnalytics/prInsightsController')();

  prInsightsRouter.route('/analytics/pr-review-insights').get(controller.getPRReviewInsights);
  prInsightsRouter.route('/analytics/pr-review-insights').post(controller.postPRReviewInsights);

  return prInsightsRouter;
};

module.exports = routes;