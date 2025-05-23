const express = require('express');

const routes = function (ToolAvailability) {
  const toolAvailabilityRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/toolAvailabilityController')(
    ToolAvailability,
  );

  // GET /api/projects/:id/tools-availability
  toolAvailabilityRouter
    .route('/bm/projects/:id/tools-availability')
    .get(controller.getToolsAvailability);

  return toolAvailabilityRouter;
};

module.exports = routes;
