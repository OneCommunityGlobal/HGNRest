const express = require('express');

const routes = function () {
  const timeloggerRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmTimeLoggerController')();

  timeloggerRouter.route('/timelogger/:projectId/users')
  .get(controller.fetchProjectMembers);

  return timeloggerRouter;
};

module.exports = routes;
