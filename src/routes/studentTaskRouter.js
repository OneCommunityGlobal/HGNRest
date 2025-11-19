const express = require('express');

const routes = function () {
  const controller = require('../controllers/studentTaskController')();
  const studentTaskRouter = express.Router();

  studentTaskRouter.route('/student/tasks').get(controller.getStudentTasks);

  studentTaskRouter.route('/student/tasks/:taskId/progress').put(controller.updateTaskProgress);

  return studentTaskRouter;
};

module.exports = routes;
