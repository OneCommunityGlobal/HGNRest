/* eslint-disable no-console */
const TaskNotification = require('../models/taskNotification');
const taskNotificationController = require('../controllers/taskNotificationController');

const taskNotificationHelper = function () {
  const createOrUpdateTaskNotification = function () {
    taskNotificationController.createOrUpdateTaskNotification();
  };

  const createNotificationsOnUpdate = async (oldTask, newInfo) => {
    const notificationPromises = [];
    const taskId = oldTask._id;
    const users = oldTask.resources;
    const task = oldTask;
    const { message } = oldTask;
    const oldTaskInfosConst = {
      oldWhyInfo: task.whyInfo,
      oldIntentInfo: task.intentInfo,
      oldEndStateInfo: task.endStateInfo,
    };

    users.forEach(async (user) => {
      const newTaskNotification = new TaskNotification({
        recipient: user.userID,
        taskId,
        message,
        taskName: task.taskName,
        taskNum: task.num,
        oldTaskInfos: {
          oldWhyInfo: '',
          oldIntentInfo: '',
          oldEndStateInfo: '',
        },
        newTaskInfos: {
          newWhyInfo: '',
          newIntentInfo: '',
          newEndStateInfo: '',
        },
      });

      const notification = await TaskNotification.findOne({
        recipient: user.userID,
        taskId,
        isRead: false,
      }).exec();
      if (notification) {
        const notifyOldWhy = notification.oldTaskInfos.oldWhyInfo;
        const notifyOldIntent = notification.oldTaskInfos.oldIntentInfo;
        const notifyOldEndState = notification.oldTaskInfos.oldEndStateInfo;
        const notifyNewWhy = notification.newTaskInfos.newWhyInfo;
        const notifyNewIntent = notification.newTaskInfos.newIntentInfo;
        const notifyNewEndState = notification.newTaskInfos.newEndStateInfo;

        // oldWhyInfo
        if (notifyOldWhy) {
          newTaskNotification.oldTaskInfos.oldWhyInfo = notifyOldWhy;
        } else if (task.whyInfo) {
          newTaskNotification.oldTaskInfos.oldWhyInfo = task.whyInfo;
        } else {
          newTaskNotification.oldTaskInfos.oldWhyInfo = '';
        }

        // oldIntentInfo
        if (notifyOldIntent) {
          newTaskNotification.oldTaskInfos.oldIntentInfo = notifyOldIntent;
        } else if (task.intentInfo) {
          newTaskNotification.oldTaskInfos.oldIntentInfo = task.intentInfo;
        } else {
          newTaskNotification.oldTaskInfos.oldIntentInfo = '';
        }

        // oldEndStateInfo
        if (notifyOldEndState) {
          newTaskNotification.oldTaskInfos.oldEndStateInfo = notifyOldEndState;
        } else if (task.endStateInfo) {
          newTaskNotification.oldTaskInfos.oldEndStateInfo = task.endStateInfo;
        } else {
          newTaskNotification.oldTaskInfos.oldEndStateInfo = '';
        }

        // newWhyInfo
        if (newInfo.newWhyInfo) {
          newTaskNotification.newTaskInfos.newWhyInfo = newInfo.newWhyInfo;
        } else if (notification.newTaskInfos.newWhyInfo) {
          newTaskNotification.newTaskInfos.newWhyInfo = notifyNewWhy;
        } else {
          newTaskNotification.newTaskInfos.newWhyInfo = '';
        }

        // newIntentInfo
        if (newInfo.newIntentInfo) {
          newTaskNotification.newTaskInfos.newIntentInfo = newInfo.newIntentInfo;
        } else if (notification.newTaskInfos.newIntentInfo) {
          newTaskNotification.newTaskInfos.newIntentInfo = notifyNewIntent;
        } else {
          newTaskNotification.newTaskInfos.newIntentInfo = '';
        }

        // newEndStateInfo
        if (newInfo.newEndStateInfo) {
          newTaskNotification.newTaskInfos.newEndStateInfo = newInfo.newEndStateInfo;
        } else if (notification.newTaskInfos.newEndStateInfo) {
          newTaskNotification.newTaskInfos.newEndStateInfo = notifyNewEndState;
        } else {
          newTaskNotification.newTaskInfos.newEndStateInfo = '';
        }

        TaskNotification.findByIdAndDelete(notification._id).catch((error) => {
          console.error(error);
        });
      } else {
        newTaskNotification.oldTaskInfos = { ...oldTaskInfosConst };
        newTaskNotification.newTaskInfos = newInfo;
      }
      notificationPromises.push(newTaskNotification.save());
    });

    Promise.all(notificationPromises).then((data) => {
      console.log(data);
    });
  };

  return {
    createOrUpdateTaskNotification,
    createNotificationsOnUpdate,
  };
};

module.exports = taskNotificationHelper;
