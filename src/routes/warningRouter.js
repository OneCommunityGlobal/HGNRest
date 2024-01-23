const express = require("express");

const routes = function (userProfile) {
  const controller = require("../controllers/warningsController")(userProfile);

  const warningRouter = express.Router();

  warningRouter
    .route("/warnings/:userId")
    .get(controller.getWarningsByUserId)
    .post(controller.postWarningsToUserProfile)
    .delete(controller.deleteUsersWarnings);

  // .post(controller.postWarningsToUserProfile);
  //
  return warningRouter;
};
module.exports = routes;
