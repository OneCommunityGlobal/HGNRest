const express = require("express");

const routes = function (UserPreferences) {
  const userPreferencesRouter = express.Router();
  const controller = require("../../controllers/lbdashboard/lbUserPrefController")(UserPreferences);

  // Route to get user preferences
  userPreferencesRouter.route("/preferences").post(controller.getPreferences);

  // Route to update user preferences
  userPreferencesRouter.route("/preferences").put(controller.updatePreferences);

  return userPreferencesRouter;
};

module.exports = routes;