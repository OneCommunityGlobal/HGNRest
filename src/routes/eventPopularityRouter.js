const express = require('express');
const eventPopularityController = require('../controllers/eventPopularityController');

const eventPopularityRouter = express.Router();
const controller = eventPopularityController();

eventPopularityRouter.get('/events/popularity', controller.getPopularityMetrics);
eventPopularityRouter.get('/events/engagement', controller.getEngagementMetrics);
eventPopularityRouter.get('/events/value', controller.getEventValue);
eventPopularityRouter.get('/events/format-comparison', controller.getFormatComparison);

module.exports = eventPopularityRouter;
