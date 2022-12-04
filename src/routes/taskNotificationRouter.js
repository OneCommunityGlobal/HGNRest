const express = require('express');

const routes = function (TaskNotification) {
  const controller = require('../controllers/taskNotificationController')(
    TaskNotification,
  );
  const TaskNotificationRouter = express.Router();

  TaskNotificationRouter.route('/task/:taskId/taskNotification')
    .post(controller.createOrUpdateTaskNotification);

  TaskNotificationRouter.route('/taskNotification/user/:userId')
    .get(controller.getUnreadTaskNotificationsByUser);

  TaskNotificationRouter.route('/taskNotification/:taskNotificationId')
    .delete(controller.deleteTaskNotification);

  TaskNotificationRouter.route('/taskNotification/read/:notificationId')
    .post(controller.markTaskNotificationAsRead);


  return TaskNotificationRouter;
};

module.exports = routes;
