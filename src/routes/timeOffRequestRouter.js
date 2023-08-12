const express = require('express');


const routes = function (timeOffRequest) {
    const timeOffRequestRouter = express.Router();
    const controller = require('../controllers/timeOffRequestController')(timeOffRequest);

    timeOffRequestRouter.route('/getTimeOffRequests')
        .get(controller.getTimeOffRequests);

    return timeOffRequestRouter;
};

module.exports = routes;
