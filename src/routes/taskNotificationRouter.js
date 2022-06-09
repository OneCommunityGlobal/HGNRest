const express = require('express');

const routes = function (TaskNotification) {
  const controller = require('../controllers/taskNotificationController')(
    TaskNotification,
  );
  const TaskNotificationRouter = express.Router();

  TaskNotificationRouter.route('/tasknotification/task/:taskId')
    .post(controller.createOrUpdateTaskNotification);

  TaskNotificationRouter.route('/tasknotification/user/:userId')
    .get(controller.getUnreadTaskNotificationsByUser);

  TaskNotificationRouter.route('/tasknotification/:notificationId')
    .delete(controller.deleteTaskNotification);

  TaskNotificationRouter.route('/tasknotification/read/:notificationId')
    .post(controller.markTaskNotificationAsRead);


  return TaskNotificationRouter;
};

module.exports = routes;
