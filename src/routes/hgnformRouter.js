const express = require("express");
const hgnFormRouter = express.Router();
const controller=require('../controllers/hgnFormController')();



hgnFormRouter.route("/")
  .get(controller.getQuestions)
  .post(controller.createQuestion);

hgnFormRouter.route("/:id")
  .put(controller.updateQuestion)
  .delete(controller.deleteQuestion);

module.exports = hgnFormRouter;