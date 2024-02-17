const express = require('express');


const routes = function (timeOffRequest) {
    const timeOffRequestRouter = express.Router();
    const controller = require('../controllers/timeOffRequestController')(timeOffRequest);

    timeOffRequestRouter.route('/setTimeOffRequest')
        .post(controller.setTimeOffRequest);

    timeOffRequestRouter.route('/getTimeOffRequests')
        .get(controller.getTimeOffRequests);

    timeOffRequestRouter.route('/getTimeOffRequest/:id')
        .get(controller.getTimeOffRequestbyId);

    timeOffRequestRouter.route('/updateTimeOffRequest/:id')
        .post(controller.updateTimeOffRequestById);

    timeOffRequestRouter.route('/deleteTimeOffRequest/:id')
        .delete(controller.deleteTimeOffRequestById);

    return timeOffRequestRouter;
};

module.exports = routes;
