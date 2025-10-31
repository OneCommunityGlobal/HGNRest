const express = require('express');
const upload = require('../middleware/multerMiddleware');

const routes = function () {
  const controller = require('../controllers/studentTaskController')();
  const studentTaskRouter = express.Router();

  studentTaskRouter.route('/student/tasks').get(controller.getStudentTasks);

  studentTaskRouter.route('/student/tasks/:taskId/progress').put(controller.updateTaskProgress);

  studentTaskRouter
    .route('/student/tasks/:taskId/upload')
    .post(upload.single('file'), controller.uploadFile);

  return studentTaskRouter;
};

module.exports = routes;
