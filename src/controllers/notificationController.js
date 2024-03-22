const mongoose = require('mongoose');
const notificationService = require('../services/notificationService');

class NotificationDTO {
  message;

  recipient;

  sender;

  constructor(message, recipient, sender) {
    this.message = message;
    this.recipient = recipient;
    this.sender = sender;
  }
}

const isValidObjectId = mongoose.Types.ObjectId.isValid;

const notificationController = function (Notification) {
  const getUserNotifications = function (req, res) {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      res.status(400).send({ error: 'Bad Request' });
      return;
    }
    if (req.requestor.requestorId !== userId && (req.body.requestor.role !== 'admin' || req.body.requestor.role !== 'owner')) {
      res.status(403).send({ error: 'Unauthorized request' });
      return;
    }

    try {
      const result = notificationService.getNotifications(userId);
      res.status(200).send(result);
    } catch (err) {
      res.status(500).send({ error: 'Internal Error' });
    }
  };

  const getUnreadUserNotifications = function (req, res) {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      res.status(400).send({ error: 'Bad Request' });
      return;
    }
    if (req.requestor.requestorId !== userId && (req.body.requestor.role !== 'admin' || req.body.requestor.role !== 'owner')) {
      res.status(403).send({ error: 'Unauthorized request' });
      return;
    }

    try {
      const result = notificationService.getNotifications(userId);
      res.status(200).send(result);
    } catch (err) {
      res.status(500).send({ error: 'Internal Error' });
    }
  };

  const createUserNotification = async function (req, res) {
    const { message, recipient } = req.body;
    const sender = req.requestor.requestorId;
    if (!isValidObjectId(sender) && (req.body.requestor.role !== 'admin' || req.body.requestor.role !== 'owner')) {
      res.status(403).send({ error: 'Unauthorized request' });
      return;
    }
    const notificationData = new NotificationDTO(message, recipient, sender);
    try {
      const result = await notificationService.createNotification(notificationData);
      res.status(200).send(result);
    } catch (err) {
      // console.log(err);
      res.status(500).send({ error: 'Internal Error' });
    }
  };

  const deleteUserNotification = function (req, res) {
    // if (!mongoose.Types.ObjectId.isValid(req.params.notificationId)) {
    //   res.status(400).send({ error: 'Bad request' }); return;
    // }

    // Notification.findById(req.params.notificationId)
    //   .then((result) => {
    //     // verify is requestor same as assignee
    //     if (req.body.requestor.role.requestorId !== result.recipient) {
    //       res.status(403).send({ error: 'Unauthroized request' });
    //       return;
    //     }
    //     result.remove()
    //       .then(res.status(200).send({ message: 'Deleted notification' }))
    //       .catch((error) => { res.status(400).send(error); });
    //   })
    //   .catch((error) => { res.status(400).send(error); });
  };

  return {
    getUserNotifications,
    getUnreadUserNotifications,
    deleteUserNotification,
    createUserNotification,
  };
};

module.exports = notificationController;
