const Notification = require('../models/notification');
const eventTypes = require('../constants/eventTypes');
const notificationController = require('../controllers/notificationController')(Notification);
const userHelper = require('./userHelper')();

const notificationHelper = function () {
  const createNotification = function (notification) {
    notificationController.createUserNotification(notification);
  };

  const notificationCreated = function (requestor, assignedTo, description) {
    userHelper.getUserName(requestor)
      .then((result) => {
        const notification = new Notification();
        notification.recipient = assignedTo;
        notification.eventType = eventTypes.ActionCreated;
        notification.message = `New action item ${description} created by ${result.firstName} ${result.lastName}`;
        createNotification(notification);
      });
  };

  const notificationEdited = function (requestor, assignedTo, olddescription, newdescription) {
    userHelper.getUserName(requestor)
      .then((result) => {
        const notification = new Notification();
        notification.recipient = assignedTo;
        notification.eventType = eventTypes.ActionEdited;
        notification.message = `Your action item was edited by ${result.firstName} ${result.lastName}. The old value was ${olddescription}. The new value is ${newdescription}`;
        createNotification(notification);
      });
  };

  const notificationDeleted = function (requestor, assignedTo, description) {
    userHelper.getUserName(requestor)
      .then((result) => {
        const notification = new Notification();
        notification.recipient = assignedTo;
        notification.eventType = eventTypes.ActionDeleted;
        notification.message = `Your action item  ${description} was deleted by ${result.firstName} ${result.lastName}.`;
        createNotification(notification);
      });
  };


  return {
    notificationCreated,
    notificationEdited,
    notificationDeleted,
  };
};

module.exports = notificationHelper;
