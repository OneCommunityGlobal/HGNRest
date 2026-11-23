/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies, import/extensions, import/no-cycle, import/order, import/no-self-import, import/no-useless-path-segments */
const express = require('express');

const routes = function (costBreakdown) {
  const controller = require('../../controllers/bmdashboard/costBreakdownController')(
    costBreakdown,
  );
  const costBreakdownRouter = express.Router();

  // Route for getting cost breakdown by expenditure type
  costBreakdownRouter.route('/project/:projectId/cost-breakdown').get(controller.getCostBreakdown);

  // Route for creating a new cost breakdown
  costBreakdownRouter.route('/project/cost-breakdown').post(controller.createCostBreakdown);

  // Route for adding a new cost entry to existing breakdown
  costBreakdownRouter
    .route('/project/:projectId/cost-breakdown/entry')
    .post(controller.addCostEntry);

  // Route for updating a specific cost entry
  costBreakdownRouter
    .route('/project/:projectId/cost-breakdown/entry/:costId')
    .put(controller.updateCostEntry);

  // Route for getting all cost breakdowns (admin)
  costBreakdownRouter.route('/cost-breakdowns').get(controller.getAllCostBreakdowns);

  // Route for deleting a cost breakdown
  costBreakdownRouter
    .route('/project/:projectId/cost-breakdown')
    .delete(controller.deleteCostBreakdown);

  return costBreakdownRouter;
};

module.exports = routes;
