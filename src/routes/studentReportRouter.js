const express = require('express');

const routes = function () {
  const controller = require('../controllers/studentReportController')();
  const studentReportRouter = express.Router();

  studentReportRouter.route('/student/:studentId').get(controller.getStudentReport);
  studentReportRouter.route('/student/:studentId/export').get(controller.getStudentReportExport);

  return studentReportRouter;
};

module.exports = routes;
