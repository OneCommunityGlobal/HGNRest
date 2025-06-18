const express = require('express');

const questionnaireAnalyticsRouter = express.Router();
const controller = require('../controllers/questionnaireAnalyticsController')();

questionnaireAnalyticsRouter.route('/users').get(controller.getUsersBySkills);

module.exports = questionnaireAnalyticsRouter;
