const mongoose = require('mongoose');

const taskNotificationController = function (TaskNotification) {
  const getUnreadTaskNotificationsByUser = function (req, res) {
    const { userId } = req.params;

    TaskNotification.find({ recipient: userId, isRead: false })
      .then((results) => {
        res.status(200).send(results);
      })
      .catch((errors) => {
        res.status(400).send(errors);
      });
  };

  const createOrUpdateTaskNotification = async (req, res) => {
    try {
      const taskId = mongoose.Types.ObjectId(req.params.taskId);
      const { oldTask, userIds } = req.body;
      // If task notification with taskId and userId exists, don't do anything.
      // Else, create new task notification.image.png
      await Promise.all(
        userIds.map(async userId => TaskNotification.updateOne(
            {
              $and: [{ taskId }, { userId: mongoose.Types.ObjectId(userId) }],
            },
            {
              $setOnInsert: {
                oldTask,
              },
            },
            {
              upsert: true,
              setDefaultsOnInsert: true,
            },
          )),
      );
      res.status(200).send({ message: 'Create or updated task notification' });
    } catch (error) {
      res.status(400).send(error);
    }
  };

  const deleteTaskNotification = function (req, res) {
    TaskNotification.findById(req.params.taskNotificationId)
      .then((result) => {
        result
          .remove()
          .then(
            res
              .status(200)
              .send({ message: 'Deleted task notification', result }),
          )
          .catch((error) => {
            res.status(400).send(error);
          });
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  // newly created function

  const deleteTaskNotificationByUserId = async (req, res) => {
    const { taskId, userId } = req.params;
    TaskNotification.findOne({
      taskId: mongoose.Types.ObjectId(taskId),
      userId: mongoose.Types.ObjectId(userId),
    })
      .populate('userId')
      .populate('taskId')
      .exec((err, result) => {
        if (err) {
          res.status(400).send(err);
        }
        result
          .remove()
          .then(res.status(200).send({ message: 'Deleted task notification' }))
          .catch((error) => {
            res.status(400).send(error);
          });
      });
  };

  const markTaskNotificationAsRead = function (req, res) {
    const { notificationId } = req.params;
    TaskNotification.findById(notificationId)
      .then((result) => {
        if (result) {
          result.isRead = true;
          result.dateRead = Date.now();
          result
            .save()
            .then(notification => res.status(200).send(notification))
            .catch(error => res.status(400).send(error));
        } else {
          res.status(404).send('TaskNotification not found.');
        }
      })
      .catch(error => res.status(400).send(error));
  };

  return {
    getUnreadTaskNotificationsByUser,
    deleteTaskNotification,
    createOrUpdateTaskNotification,
    markTaskNotificationAsRead,
    deleteTaskNotificationByUserId,
  };
};

module.exports = taskNotificationController;
