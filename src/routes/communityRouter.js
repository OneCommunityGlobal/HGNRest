const express = require('express');

const router = express.Router();

const requireQuestionnaireResultsAccess = require('../middleware/requireQuestionnaireResultsAccess');

const routes = function () {
  const controller = require('../controllers/communityController')();

  const communityRouter = express.Router();

  communityRouter
    .route('/community')
    .get(requireQuestionnaireResultsAccess, controller.getCommunityMembers);

  return communityRouter;
};

module.exports = routes;
