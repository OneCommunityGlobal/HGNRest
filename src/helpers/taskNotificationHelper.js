const TaskNotification = require('../models/taskNotification');
const taskNotificationController = require('../controllers/taskNotificationController');

const taskNotificationHelper = function () {
  const createTaskNotification = function () {
    taskNotificationController.createTaskNotification();
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
      oldEndstateInfo: task.endstateInfo,
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
          oldEndstateInfo: '',
        },
        newTaskInfos: {
          newWhyInfo: '',
          newIntentInfo: '',
          newEndstateInfo: '',
        },
      });

      const notification = await TaskNotification.findOne({
        recipient: user.userID,
        taskId,
        isRead: false,
      }).exec();
      if (notification) {
        const notifOldWhy = notification.oldTaskInfos.oldWhyInfo;
        const notifOldIntent = notification.oldTaskInfos.oldIntentInfo;
        const notifOldEndstate = notification.oldTaskInfos.oldEndstateInfo;
        const notifNewWhy = notification.newTaskInfos.newWhyInfo;
        const notifNewIntent = notification.newTaskInfos.newIntentInfo;
        const notifNewEndstate = notification.newTaskInfos.newEndstateInfo;

        // oldWhyInfo
        if (notifOldWhy) {
          newTaskNotification.oldTaskInfos.oldWhyInfo = notifOldWhy;
        } else if (task.whyInfo) {
          newTaskNotification.oldTaskInfos.oldWhyInfo = task.whyInfo;
        } else {
          newTaskNotification.oldTaskInfos.oldWhyInfo = '';
        }

        // oldIntentInfo
        if (notifOldIntent) {
          newTaskNotification.oldTaskInfos.oldIntentInfo = notifOldIntent;
        } else if (task.intentInfo) {
          newTaskNotification.oldTaskInfos.oldIntentInfo = task.intentInfo;
        } else {
          newTaskNotification.oldTaskInfos.oldIntentInfo = '';
        }

        // oldEndstateInfo
        if (notifOldEndstate) {
          newTaskNotification.oldTaskInfos.oldEndstateInfo = notifOldEndstate;
        } else if (task.endstateInfo) {
          newTaskNotification.oldTaskInfos.oldEndstateInfo = task.endstateInfo;
        } else {
          newTaskNotification.oldTaskInfos.oldEndstateInfo = '';
        }

        // newWhyInfo
        if (newInfo.newWhyInfo) {
          newTaskNotification.newTaskInfos.newWhyInfo = newInfo.newWhyInfo;
        } else if (notification.newTaskInfos.newWhyInfo) {
          newTaskNotification.newTaskInfos.newWhyInfo = notifNewWhy;
        } else {
          newTaskNotification.newTaskInfos.newWhyInfo = '';
        }

        // newIntentInfo
        if (newInfo.newIntentInfo) {
          newTaskNotification.newTaskInfos.newIntentInfo = newInfo.newIntentInfo;
        } else if (notification.newTaskInfos.newIntentInfo) {
          newTaskNotification.newTaskInfos.newIntentInfo = notifNewIntent;
        } else {
          newTaskNotification.newTaskInfos.newIntentInfo = '';
        }

        // newEndstateInfo
        if (newInfo.newEndstateInfo) {
          newTaskNotification.newTaskInfos.newEndstateInfo = newInfo.newEndstateInfo;
        } else if (notification.newTaskInfos.newEndstateInfo) {
          newTaskNotification.newTaskInfos.newEndstateInfo = notifNewEndstate;
        } else {
          newTaskNotification.newTaskInfos.newEndstateInfo = '';
        }

        TaskNotification.findByIdAndDelete(notification._id).catch(error => console.error(error));
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
    createTaskNotification,
    createNotificationsOnUpdate,
  };
};

module.exports = taskNotificationHelper;
