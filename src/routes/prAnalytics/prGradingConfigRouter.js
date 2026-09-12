const express = require('express');

const routes = function (PRGradingConfig) {
  const prGradingConfigRouter = express.Router();
  const controller = require('../../controllers/prAnalytics/prGradingConfigController')(
    PRGradingConfig,
  );

  prGradingConfigRouter.route('/pr-grading-config').get(controller.getAllConfigs);
  prGradingConfigRouter.route('/pr-grading-config').post(controller.createConfig);
  prGradingConfigRouter.route('/pr-grading-config/:id').delete(controller.deleteConfig);

  return prGradingConfigRouter;
};

module.exports = routes;
