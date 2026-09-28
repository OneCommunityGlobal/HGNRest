const express = require('express');

const routes = function () {
  const controller = require('../controllers/studentTaskController')();
  const studentTaskRouter = express.Router();

  // POST /api/studentTasks - Assign a new task
  studentTaskRouter.route('/').post(controller.createStudentTask);

  // GET /api/studentTasks - Get all student tasks
  studentTaskRouter.route('/').get(controller.getAllStudentTasks);

  // GET /api/studentTasks/student/:studentId - Get tasks by student
  studentTaskRouter.route('/student/:studentId').get(controller.getTasksByStudent);

  // PATCH /api/studentTasks/:id - Update task status
  studentTaskRouter.route('/:id').patch(controller.updateStudentTask);

  return studentTaskRouter;
};

module.exports = routes;
