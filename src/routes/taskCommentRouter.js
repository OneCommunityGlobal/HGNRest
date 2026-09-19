const express = require('express');
const taskCommentController = require('../controllers/taskCommentController');

const routes = function () {
  const taskCommentRouter = express.Router();

  taskCommentRouter.post(
    '/student/tasks/:taskId/comments',
    taskCommentController.postStudentComments,
  );

  taskCommentRouter.get(
    '/student/tasks/:taskId/comments',
    taskCommentController.getStudentCommentsbyStudent,
  );

  taskCommentRouter.get(
    '/educator/tasks/:taskId/comments',
    taskCommentController.getStudentCommentsbyEducator,
  );

  taskCommentRouter.delete(
    '/student/tasks/:taskId/comments/:commentId',
    taskCommentController.deleteStudentComment,
  );

  return taskCommentRouter;
};

module.exports = routes;
