const express = require('express');

const activityLogRouter = express.Router();
// Invoke the controller factory
const controller = require('../controllers/activityLogController')();

activityLogRouter.route('/:studentId').get(controller.fetchSupportDailyLog);

// Export the INSTANCE
module.exports = activityLogRouter;
