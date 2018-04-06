var express = require('express');
var notification = require('../models/notification');
var eventtypes = require('../constants/eventTypes');
var notificationController = require('../controllers/notificationController')(notification);
var userhelper = require('../helpers/userhelper')();

var notificationhelper = function () {



  let notificationcreated = function (requestor, assignedTo, description) {
    userhelper.getUserName(requestor)
      .then((result) => {
        let _notification = new notification();
        _notification.recipient = assignedTo;
        _notification.eventType = eventtypes.ActionCreated;
        _notification.message = `New action item ${description} created by ${result.firstName} ${result.lastName}`;
        __createnotification(_notification);

      })

  };

  let notificationedited = function (requestor, assignedTo, olddescription, newdescription) {

    userhelper.getUserName(requestor)
      .then((result) => {
        let _notification = new notification();
        _notification.recipient = assignedTo;
        _notification.eventType = eventtypes.ActionEdited;
        _notification.message = `Your action item was edited by ${result.firstName} ${result.lastName}. The old value was ${olddescription}. The new value is ${newdescription}`;
        __createnotification(_notification);

      })
  };

  let notificationdeleted = function (requestor, assignedTo, description) {

    userhelper.getUserName(requestor)
      .then((result) => {
        let _notification = new notification();
        _notification.recipient = assignedTo;
        _notification.eventType = eventtypes.ActionDeleted;
        _notification.message = `Your action item  ${description} was deleted by ${result.firstName} ${result.lastName}.`;
        __createnotification(_notification);
      })


  }

  var __createnotification = function (notification) {

    notificationController.createUserNotification(notification);

  };


  return {
    notificationcreated: notificationcreated,
    notificationedited: notificationedited,
    notificationdeleted: notificationdeleted
  }


};

module.exports = notificationhelper;
