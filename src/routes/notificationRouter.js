const express = require('express');

const routes = function () {
  const controller = require('../controllers/notificationController')();
  const notificationRouter = express.Router();

  notificationRouter
    .route('/notification/user/:userId')
    .get(controller.getUserNotifications);

  notificationRouter
    .route('/notification/unread/user/:userId')
    .get(controller.getUnreadUserNotifications);

  notificationRouter
    .route('/notification/sendHistory/')
    .get(controller.getSentNotifications);

  notificationRouter
    .route('/notification/')
    .post(controller.createUserNotification);

  notificationRouter
    .route('/notification/:notificationId')
    .delete(controller.deleteUserNotification);

  notificationRouter
    .route('/notification/markRead/:notificationId')
    .post(controller.markNotificationAsRead);

  return notificationRouter;
};

module.exports = routes;
