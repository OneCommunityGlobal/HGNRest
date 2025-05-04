const express = require("express");

const routes = function (UserPreferences, Notification) {
  const userPreferencesRouter = express.Router();
  const controller = require("../../controllers/lbdashboard/lbUserPrefController")(UserPreferences, Notification);

  // Route to get user preferences
  userPreferencesRouter.route("/preferences").post(controller.getPreferences);

  // Route to update user preferences
  userPreferencesRouter.route("/preferences").put(controller.updatePreferences);

  userPreferencesRouter.route("/notifications").post(controller.storeNotification);

  userPreferencesRouter.route("/notifications/unread/user/:userId").get(controller.getUnreadNotifications);

  userPreferencesRouter.route("/notifications/mark-as-read").post(controller.markNotificationsAsRead);

  return userPreferencesRouter;
};

module.exports = routes;