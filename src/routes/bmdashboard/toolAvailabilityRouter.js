const express = require('express');
const ToolAvailability = require('../../models/bmdashboard/toolAvailability');
const toolAvailabilityController = require('../../controllers/bmdashboard/toolAvailabilityController');

const routes = function () {
  const toolAvailabilityRouter = express.Router();
  const controller = toolAvailabilityController(ToolAvailability);

  // GET /api/bm/projects/:id/tools-availability
  toolAvailabilityRouter
    .route('/bm/projects/:id/tools-availability')
    .get(controller.getToolsAvailability);

  // GET /api/bm/tools-availability/projects
  toolAvailabilityRouter
    .route('/bm/tools-availability/projects')
    .get(controller.getUniqueProjectIds);

  return toolAvailabilityRouter;
};

module.exports = routes;
