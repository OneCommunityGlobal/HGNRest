/* eslint-disable linebreak-style */
const mongoose = require('mongoose');

const taskEditSuggestionController = function (TaskEditSuggestion) {
  const getUnreadTaskNotificationsByUser = function (req, res) {
    const { userId } = req.params;

    TaskEditSuggestion.find({ recipient: userId, isRead: false })
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
      await Promise.all(
        userIds.map(async userId => (
          TaskEditSuggestion.updateOne({
            $and: [
              { taskId },
              { userId: mongoose.Types.ObjectId(userId) },
            ],
          },
          {
            $setOnInsert: {
              oldTask,
            },
          },
          {
            upsert: true,
            setDefaultsOnInsert: true,
          })
        )),
      );

      res.status(200).send({ message: 'Create or updated task notification' });
    } catch (error) {
      console.log(error);
      res.status(400).send(error);
    }
  };

  const deleteTaskNotification = function (req, res) {
    TaskEditSuggestion.findById(req.params.taskNotificationId)
      .then((result) => {
        // // verify is requestor same as assignee
        // if (req.body.requestor.requestorId !== result.recipient) {
        //   res.status(403).send({ error: "Unauthroized request" });
        //   return;
        // }
        result
          .remove()
          .then(res.status(200).send({ message: 'Deleted task notification' }))
          .catch((error) => {
            res.status(400).send(error);
          });
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  const markTaskNotificationAsRead = function (req, res) {
    const { notificationId } = req.params;
    TaskEditSuggestion.findById(notificationId)
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
  };
};

module.exports = taskEditSuggestionController;
