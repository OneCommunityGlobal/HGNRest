const express = require('express');

const routes = function (ToolNeedReplacement) {
  const toolReplacementRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmToolReplacementController')(ToolNeedReplacement);

  // GET /api/bm/projects/:id/tools-availability
  toolReplacementRouter
    .route('/bm/projects/:id/tools-replacement')
    .get(controller.getToolsNeedReplacement);

  // GET /api/bm/tools-availability/projects
  toolReplacementRouter
    .route('/bm/tools-replacement/projects')
    .get(controller.getUniqueProjectIds);

  return toolReplacementRouter;
};

module.exports = routes;