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
    .route('/education-tasks/student/:studentId')
    .get(controller.getTasksByStudent);

  educationTaskRouter
    .route('/education-tasks/lesson-plan/:lessonPlanId')
    .get(controller.getTasksByLessonPlan);

  educationTaskRouter.route('/education-tasks/status/:status').get(controller.getTasksByStatus);

  // Student self-service: mark a (read-only or intermediate) task as complete
  educationTaskRouter
    .route('/education-tasks/student/mark-complete')
    .post(controller.markTaskAsComplete);

  // Accept both PUT (this feature) and PATCH (development) for status/grade updates
  educationTaskRouter
    .route('/education-tasks/:id/status')
    .put(controller.updateTaskStatus)
    .patch(controller.updateTaskStatus);

  educationTaskRouter
    .route('/education-tasks/:id/grade')
    .put(controller.gradeTask)
    .patch(controller.gradeTask);

  educationTaskRouter
    .route('/education-tasks/:id')
    .get(controller.getTaskById)
    .put(controller.updateTask)
    .delete(controller.deleteTask);

  // Educator review routes
  educationTaskRouter
    .route('/educator/review/:submissionId')
    .get(controller.getSubmissionForReview)
    .post(controller.updateSubmissionGrade);

  educationTaskRouter.route('/educator/task-submissions').get(controller.getReviewSubmissions);

  return educationTaskRouter;
};

module.exports = routes;
