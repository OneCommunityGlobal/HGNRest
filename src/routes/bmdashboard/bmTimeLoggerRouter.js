const express = require('express');

const routes = function (bmTimeLog) {
  const timeloggerRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmTimeLoggerController')(bmTimeLog);

  // Route to start/resume time logging
  timeloggerRouter.route('/timelogger/:projectId/:memberId/start').post(controller.startTimeLog);

  // Route to pause time logging
  timeloggerRouter.route('/timelogger/:projectId/:memberId/pause').post(controller.pauseTimeLog);

  // Route to stop time logging
  timeloggerRouter.route('/timelogger/:projectId/:memberId/stop').post(controller.stopTimeLog);

  // Route to get time logs for all members in a project (must come BEFORE the member-specific route)
  timeloggerRouter.route('/timelogger/:projectId/logs').get(controller.getProjectTimeLogs);

  // Route to get time logs for a specific member (more specific route comes after general one)
  timeloggerRouter
    .route('/timelogger/:projectId/:memberId/logs')
    .get(controller.getProjectTimeLogs);

  return timeloggerRouter;
};

module.exports = routes;
