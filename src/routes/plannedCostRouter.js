const express = require('express');

const routes = function (PlannedCost, Project) {
  const controller = require('../controllers/plannedCostController')(PlannedCost, Project);
  const plannedCostRouter = express.Router();

  // Include /projects prefix in the router paths
  plannedCostRouter.route('/projects/:projectId/planned-cost-breakdown').get((req, res, next) => {
    console.log('[Router] Route hit for planned-cost-breakdown, projectId:', req.params.projectId);
    next();
  }, controller.getPlannedCostBreakdown);

  plannedCostRouter
    .route('/projects/:projectId/planned-costs')
    .get(controller.getAllPlannedCostsForProject)
    .post(controller.createOrUpdatePlannedCost);

  plannedCostRouter
    .route('/projects/:projectId/planned-costs/:category')
    .delete(controller.deletePlannedCost);

  return plannedCostRouter;
};

module.exports = routes;
