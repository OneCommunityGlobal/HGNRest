/* eslint-disable linebreak-style */
const express = require('express');

const routes = function (TaskEditSuggestion) {
  const controller = require('../controllers/taskEditSuggestionController')(
    TaskEditSuggestion,
  );
  const TaskEditSuggestionRouter = express.Router();

  TaskEditSuggestionRouter.route('/task/:taskId/tasknotification')
    .post(controller.createOrUpdateTaskNotification);

  TaskEditSuggestionRouter.route('/tasknotification/user/:userId')
    .get(controller.getUnreadTaskNotificationsByUser);

  TaskEditSuggestionRouter.route('/tasknotification/:taskNotificationId')
    .delete(controller.deleteTaskNotification);

  TaskEditSuggestionRouter.route('/tasknotification/read/:notificationId')
    .post(controller.markTaskNotificationAsRead);


  return TaskEditSuggestionRouter;
};

module.exports = routes;
