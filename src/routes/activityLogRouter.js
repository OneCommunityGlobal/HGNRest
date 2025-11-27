const express = require('express');

const routes = function () {
  const activityLogRouter = express.Router();
  const controller = require('../controllers/activityLogController')();

  activityLogRouter.route('/support/:studentId').get(controller.fetchSupportDailyLog);

  return activityLogRouter;
};

module.exports = routes;
