const express = require('express');

const routes = function () {
  const activityLogRouter = express.Router();
  const controller = require('../controllers/activityLogController')();
  activityLogRouter.route('/student/daily-log').get(controller.fetchStudentDailyLog);

  activityLogRouter.route('/educator/daily-log/:studentId').get(controller.fetchEducatorDailyLog);

  return activityLogRouter;
};

module.exports = routes;
