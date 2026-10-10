const express = require('express');

const routes = function (PRGradingConfig, UserProfile, HgnFormResponse, Team) {
  const prGradingConfigRouter = express.Router();
  const controller = require('../../controllers/prAnalytics/prGradingConfigController')(
    PRGradingConfig,
    UserProfile,
    HgnFormResponse,
    Team,
  );

  prGradingConfigRouter.route('/pr-grading-config').get(controller.getAllConfigs);
  prGradingConfigRouter.route('/pr-grading-config').post(controller.createConfig);
  prGradingConfigRouter.route('/pr-grading-config/:id').delete(controller.deleteConfig);
  prGradingConfigRouter.route('/pr-grading-config/sync-reviewers').post(controller.syncReviewers);

  return prGradingConfigRouter;
};

module.exports = routes;
