const express = require('express');

const hgnFormResponseRouter = express.Router();
const controller = require('../controllers/hgnFormResponseController')();
const questionnaireController = require('../controllers/questionnaireController')();

// controler to post data, view data
hgnFormResponseRouter
  .route('/')
  .post(controller.submitFormResponse)
  .get(controller.getAllFormResponses);

hgnFormResponseRouter.route('/ranked').get(controller.getRankedResponses);

// Questionnaire completion status
hgnFormResponseRouter
  .route('/questionnaire/status')
  .get(questionnaireController.getQuestionnaireStatus);

module.exports = hgnFormResponseRouter;
