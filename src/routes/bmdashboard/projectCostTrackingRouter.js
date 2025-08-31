const express = require('express');

<<<<<<< HEAD
const routes = function (projectCost) {
  const controller = require('../../controllers/bmdashboard/projectCostController')(projectCost);
  const projectCostRouter = express.Router();

  // Base routes for all projects
  projectCostRouter.route('/project')
    .get(controller.getAllProjects)
    .post(controller.createProject);
    
  // Route for getting cost predictions
  projectCostRouter.route('/project/:projectId/predictions')
    .get(controller.getProjectPredictions);

  // Route for getting planned and actual costs
  projectCostRouter.route('/project/:projectId/costs')
    .get(controller.getProjectCosts);

  return projectCostRouter;
};

module.exports = routes; 
=======
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
>>>>>>> 386a99463e79e889e2dcd48aeba1cf15f5005398
