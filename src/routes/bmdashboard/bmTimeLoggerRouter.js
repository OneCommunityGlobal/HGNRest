const express = require('express');

const routes = function (bmTimeLog) {
  const timeloggerRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmTimeLoggerController')(bmTimeLog);

  // Route to start/resume time logging
  timeloggerRouter.route('/timelogger/:projectId/:memberId/start')
    .post(controller.startTimeLog);

  // Route to pause time logging
  timeloggerRouter.route('/timelogger/:projectId/:memberId/pause')
    .post(controller.pauseTimeLog);

  // Route to stop time logging
  timeloggerRouter.route('/timelogger/:projectId/:memberId/stop')
    .post(controller.stopTimeLog);

  // Route to get time logs (optional member filter)
  timeloggerRouter.route('/timelogger/:projectId/:memberId/logs')
    .get(controller.getProjectTimeLogs);

  return timeloggerRouter;
};

module.exports = routes;