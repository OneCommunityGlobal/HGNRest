const express = require('express');

const routes = function (ProjectCostTracking) {
  const projectCostTrackingRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/projectCostTrackingController')(
    ProjectCostTracking,
  );

  // GET /api/bm/projects/:id/costs
  projectCostTrackingRouter.route('/bm/projects/:id/costs').get(controller.getProjectCosts);

  // GET /api/bm/projects-cost/ids
  projectCostTrackingRouter.route('/bm/projects-cost/ids').get(controller.getAllProjectIds);

  return projectCostTrackingRouter;
};

module.exports = routes;
