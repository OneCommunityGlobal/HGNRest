const express = require('express');

const router = function (toolRentalUsageCost) {
  const toolRentalCostRouter = express.Router();
  const bmToolsRentalCostController =
    require('../../controllers/bmdashboard/bmToolsRentalCostContoller')(toolRentalUsageCost);

  toolRentalCostRouter
    .route('/rentals/cost-over-time')
    .get(bmToolsRentalCostController.getRentalsCostOverTime);
  toolRentalCostRouter
    .route('/tools/cost-breakdown')
    .get(bmToolsRentalCostController.getToolsCostBreakdown);
  toolRentalCostRouter.route('/tools/projects').get(bmToolsRentalCostController.getUniqueProjects);
  return toolRentalCostRouter;
};

module.exports = router;
