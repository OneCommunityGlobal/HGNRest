const express = require('express');

const routes = function (Cost, Project) {
  const controller = require('../controllers/plannedCostController')(Cost, Project);
  const CostRouter = express.Router();

  // Include /projects prefix in the router paths
  CostRouter.route('/projects/:projectId/planned-cost-breakdown').get((req, res, next) => {
    console.log('[Router] Route hit for planned-cost-breakdown, projectId:', req.params.projectId);
    next();
  }, controller.getPlannedCostBreakdown);

  CostRouter
    .route('/projects/:projectId/planned-costs')
    .get(controller.getAllPlannedCostsForProject)
    .post(controller.createOrUpdatePlannedCost);

  CostRouter
    .route('/projects/:projectId/planned-costs/:category')
    .delete(controller.deletePlannedCost);

  return CostRouter;
};

module.exports = routes;
