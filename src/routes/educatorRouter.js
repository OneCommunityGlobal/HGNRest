const express = require('express');

const routes = function () {
  const controller = require('../controllers/educatorController')();
  const educatorRouter = express.Router();

  // POST /api/educator/assign-tasks - Main assignment endpoint
  educatorRouter.route('/assign-tasks').post(controller.assignTasks);

  // GET /api/educator/assignments/:lessonPlanId - Get assignment summary
  educatorRouter.route('/assignments/:lessonPlanId').get(controller.getAssignmentSummary);

  return educatorRouter;
};

module.exports = routes;
