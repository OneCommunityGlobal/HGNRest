const express = require("express");

const route = function () {
  const controller = require("../controllers/currentWarningsController")();

  const currentWarningsRouter = express.Router();

  currentWarningsRouter
    .route("/currentWarnings")
    .get(controller.getCurrentDescriptions);
  // .post(controller.addCurrentDescriptions)
  // .put(controller.updateCurrentDescriptions)
  // .delete(controller.deleteCurrentDescriptions);

  return currentWarningsRouter;
};

module.exports = route;
