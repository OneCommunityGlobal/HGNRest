const express = require('express');

const routes = function (ToolStoppageReason) {
  const bmToolStoppageReasonRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmToolStoppageReasonController')(
    ToolStoppageReason,
  );

  // GET /api/bm/projects/:id/tools-stoppage-reason
  bmToolStoppageReasonRouter
    .route('/bm/projects/:id/tools-stoppage-reason')
    .get(controller.getToolsStoppageReason);

  // GET /api/bm/tools-stoppage-reason/projects
  bmToolStoppageReasonRouter
    .route('/bm/tools-stoppage-reason/projects')
    .get(controller.getUniqueProjectIds);

  return bmToolStoppageReasonRouter;
};

module.exports = routes;
