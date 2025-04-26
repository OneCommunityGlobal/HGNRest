const express = require("express");
const hgnFormResponseRouter = express.Router();
const controller = require("../controllers/hgnFormResponseController")();
// controler to post data, view data
hgnFormResponseRouter.route("/").post(controller.submitFormResponse).get(controller.getAllFormResponses);
hgnFormResponseRouter.route("/ranked")
  .get(controller.getRankedResponses);
module.exports = hgnFormResponseRouter;
