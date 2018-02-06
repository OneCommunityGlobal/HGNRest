var express = require('express');


var routes = function (notification) {
  var controller = require('../controllers/notificationController')(notification);
  var notificationRouter = express.Router();

  // notificationRouter.route('/notification')
  // .post(controller.createUserNotifications)


  notificationRouter.route('/notification/:userId')
    .get(controller.getUserNotifications)
      

    notificationRouter.route('/notification/:userId/:notificationId')
    .put(controller.putUserNotification)
    
    return notificationRouter;

};

module.exports = routes;
