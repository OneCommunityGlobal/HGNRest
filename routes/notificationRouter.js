var express = require('express');


var routes = function (notification) {
  var controller = require('../controllers/notificationController')(notification);
  var notificationRouter = express.Router();

  // notificationRouter.route('/notification')
  // .post(controller.createUserNotifications)


  notificationRouter.route('/notification/user/:userId')
    .get(controller.getUserNotifications)
      

    notificationRouter.route('/notification/:notificationId')
    .delete(controller.deleteUserNotification)
    
    return notificationRouter;

};

module.exports = routes;
