const express = require('express');

const eventFeedbackRouter = express.Router();
const controller = require('../../controllers/CommunityPortal/eventFeedbackController')();
// controller to post data data
eventFeedbackRouter.route('/eventFeedback').post(controller.submitEventFeedbackResponse);

module.exports = eventFeedbackRouter;
