const express = require('express');
const taskCommentController = require('../controllers/taskCommentController');

const router = function () {
  const taskCommentRouter = express.Router();

  taskCommentRouter.post(
    '/student/tasks/:taskId/comments',
    taskCommentController.postStudentComments,
  );
  taskCommentRouter.get(
    '/educator/tasks/:taskId/comments',
    taskCommentController.getStudentCommentsbyEducator,
  );
  taskCommentRouter.get(
    '/student/tasks/:taskId/comments',
    taskCommentController.getStudentCommentsbyStudent,
  );
};

module.exports = router;
