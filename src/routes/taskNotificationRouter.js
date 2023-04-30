const express = require('express');

const routes = function (TaskNotification) {
  const controller = require('../controllers/taskNotificationController')(
    TaskNotification,
  );
  const TaskNotificationRouter = express.Router();

  TaskNotificationRouter.route('/task/:taskId/tasknotification').post(
    controller.createOrUpdateTaskNotification,
  );

  TaskNotificationRouter.route('/tasknotification/user/:userId').get(
    controller.getUnreadTaskNotificationsByUser,
  );

  TaskNotificationRouter.route('/tasknotification/:taskNotificationId').delete(
    controller.deleteTaskNotification,
  );

  TaskNotificationRouter.route('/tasknotification/read/:notificationId').post(
    controller.markTaskNotificationAsRead,
  );


  // newly created endpoint

  TaskNotificationRouter.route(
    '/tasknotification/:userId/:taskNotificationId',
  ).delete(controller.deleteTaskNotificationByUserId);

  return TaskNotificationRouter;
};

module.exports = routes;
