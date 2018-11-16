const express = require('express');


const routes = function (notification) {
  const controller = require('../controllers/notificationController')(notification);
  const notificationRouter = express.Router();

  // notificationRouter.route('/notification')
  // .post(controller.createUserNotifications)


  notificationRouter.route('/notification/user/:userId')
    .get(controller.getUserNotifications);


  notificationRouter.route('/notification/:notificationId')
    .delete(controller.deleteUserNotification);

  return notificationRouter;
};

module.exports = routes;
