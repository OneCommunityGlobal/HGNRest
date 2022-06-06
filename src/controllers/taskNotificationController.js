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

  const createOrUpdateTaskNotification = function (req, res) {
    const newTaskNotification = new TaskNotification();
    newTaskNotification.message = req.body.message;
    newTaskNotification.recipient = req.body.recipient;
    newTaskNotification.taskId = req.body.taskId;
    newTaskNotification.taskName = req.body.taskName;
    newTaskNotification.taskNum = req.body.taskNum;

    if (req.body.oldTaskInfos) {
      if (req.body.oldTaskInfos.oldWhyInfo) {
        newTaskNotification.oldTaskInfos.oldWhyInfo = req.body.oldTaskInfos.oldWhyInfo;
      }
      if (req.body.oldTaskInfos.oldIntentInfo) {
        newTaskNotification.oldTaskInfos.oldWhyInfo = req.body.oldTaskInfos.oldIntentInfo;
      }
      if (req.body.oldTaskInfos.oldEndstateInfo) {
        newTaskNotification.oldTaskInfos.oldWhyInfo = req.body.oldTaskInfos.oldEndstateInfo;
      }
    }
    if (req.body.newTaskInfos) {
      if (req.body.newTaskInfos.newWhyInfo) {
        newTaskNotification.newTaskInfos.newWhyInfo = req.body.newTaskInfos.newWhyInfo;
      }
      if (req.body.newTaskInfos.newIntentInfo) {
        newTaskNotification.newTaskInfos.newIntentInfo = req.body.newTaskInfos.newIntentInfo;
      }
      if (req.body.newTaskInfos.newEndstateInfo) {
        newTaskNotification.newTaskInfos.newEndstateInfo = req.body.newTaskInfos.newEndstateInfo;
      }
    }

    newTaskNotification
      .save()
      .then(results => res.status(200).send(results))
      .catch(error => res.status(400).send(error));
  };

  const deleteTaskNotification = function (req, res) {
    TaskNotification.findById(req.params.taskNotificationId)
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
  };
};

module.exports = taskNotificationController;
