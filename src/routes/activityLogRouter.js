const express = require('express');

const routes = function () {
  const activityLogRouter = express.Router();
  const controller = require('../controllers/activityLogController')();

  activityLogRouter.get(
    ['/educator/daily-log/:studentId', '/support/daily-log/:studentId'],
    controller.fetchStudentDailyLogsByStaff,
  );

  activityLogRouter
    .route('/student/daily-log')
    .get(controller.fetchStudentDailyLog)
    .post(controller.createStudentDailyLog);

  activityLogRouter.route('/student/daily-log/:logId').put(controller.updateStudentDailyLog);

  return activityLogRouter;
};

module.exports = routes;
