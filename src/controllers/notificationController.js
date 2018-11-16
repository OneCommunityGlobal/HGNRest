const mongoose = require('mongoose');

const notificationController = function (Notification) {
  const getUserNotifications = function (req, res) {
    const userid = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(userid)) {
      res.status(400).send({ error: 'Bad Request' });
      return;
    }

    Notification.find({ recipient: userid }, '_id message eventType')
      .then((results) => { res.status(200).send(results); })
      .catch((errors) => { res.status(400).send(errors); });
  };

  const createUserNotification = function (notification) {
    notification.save();
    // .then(results => { console.log(` notification created with id ${results._id}`) })
    // .catch(error => { console.log(error) });
  };

  const deleteUserNotification = function (req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.notificationId)) {
      res.status(400).send({ error: 'Bad request' }); return;
    }

    Notification.findById(req.params.notificationId)
      .then((result) => {
        // verify is requestor same as assignee
        if (req.body.requestor.requestorId !== result.recipient) {
          res.status(403).send({ error: 'Unauthroized request' });
          return;
        }
        result.remove()
          .then(res.status(200).send({ message: 'Deleted notification' }))
          .catch((error) => { res.status(400).send(error); });
      })
      .catch((error) => { res.status(400).send(error); });
  };


  return {
    getUserNotifications,
    deleteUserNotification,
    createUserNotification,
  };
};

module.exports = notificationController;
