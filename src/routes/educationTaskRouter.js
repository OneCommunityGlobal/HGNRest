const express = require('express');

const routes = function () {
  const controller = require('../controllers/educationTaskController')();
  const educationTaskRouter = express.Router();

  // General education task routes
  educationTaskRouter
    .route('/education-tasks')
    .get(controller.getEducationTasks)
    .post(controller.createTask);

  educationTaskRouter
    .route('/education-tasks/:id')
    .get(controller.getTaskById)
    .put(controller.updateTask)
    .delete(controller.deleteTask);

  educationTaskRouter
    .route('/education-tasks/student/:studentId')
    .get(controller.getTasksByStudent);

  educationTaskRouter
    .route('/education-tasks/lesson-plan/:lessonPlanId')
    .get(controller.getTasksByLessonPlan);

  educationTaskRouter.route('/education-tasks/status/:status').get(controller.getTasksByStatus);

  educationTaskRouter.route('/education-tasks/:id/status').put(controller.updateTaskStatus);

  educationTaskRouter.route('/education-tasks/:id/grade').put(controller.gradeTask);

  // Educator review routes
  educationTaskRouter
    .route('/educator/review/:submissionId')
    .get(controller.getSubmissionForReview)
    .post(controller.updateSubmissionGrade);

  educationTaskRouter.route('/educator/task-submissions').get(controller.getTaskSubmissions);

  return educationTaskRouter;
};

module.exports = routes;
