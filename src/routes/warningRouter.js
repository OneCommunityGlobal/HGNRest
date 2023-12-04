const express = require("express");

const routes = function () {
  const controller = require("../controllers/warningsController");

  const warningRouter = express.Router();

  warningRouter.route("/warnings/:id").get(controller.getWarningsByUserId);

  return warningRouter;
};
module.exports = routes;
