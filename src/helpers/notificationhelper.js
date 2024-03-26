const Notification = require('../models/notification');
const eventtypes = require('../constants/eventTypes');
const notificationController = require('../controllers/notificationController')(Notification);
const userhelper = require('./userHelper')();

const notificationhelper = function () {
  const createnotification = function (notification) {
    notificationController.createUserNotification(notification);
  };

  const notificationcreated = function (requestor, assignedTo, description) {
    userhelper.getUserName(requestor)
      .then((result) => {
        const notification = new Notification();
        notification.recipient = assignedTo;
        notification.eventType = eventtypes.ActionCreated;
        notification.message = `New action item ${description} created by ${result.firstName} ${result.lastName}`;
        createnotification(notification);
      });
  };

  const notificationedited = function (requestor, assignedTo, olddescription, newdescription) {
    userhelper.getUserName(requestor)
      .then((result) => {
        const notification = new Notification();
        notification.recipient = assignedTo;
        notification.eventType = eventtypes.ActionEdited;
        notification.message = `Your action item was edited by ${result.firstName} ${result.lastName}. The old value was ${olddescription}. The new value is ${newdescription}`;
        createnotification(notification);
      });
  };

  const notificationdeleted = function (requestor, assignedTo, description) {
    userhelper.getUserName(requestor)
      .then((result) => {
        const notification = new Notification();
        notification.recipient = assignedTo;
        notification.eventType = eventtypes.ActionDeleted;
        notification.message = `Your action item  ${description} was deleted by ${result.firstName} ${result.lastName}.`;
        createnotification(notification);
      });
  };

  return {
    notificationcreated,
    notificationedited,
    notificationdeleted,
  };
};

module.exports = notificationhelper;
