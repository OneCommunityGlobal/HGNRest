const express = require('express');

const routes = function (ToolStoppageReason) {
  const bmToolStoppageReasonRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/toolStoppageReasonController')(
    ToolStoppageReason,
  );

  // GET /api/bm/projects/:id/tools-availability
  bmToolStoppageReasonRouter
    .route('/bm/projects/:id/tools-stoppage-reason')
    .get(controller.getToolsStoppageReason);

  // GET /api/bm/tools-availability/projects
  bmToolStoppageReasonRouter
    .route('/bm/tools-stoppage-reason/projects')
    .get(controller.getUniqueProjectIds);

  return bmToolStoppageReasonRouter;
};

module.exports = routes;