const express = require('express');

const routes = function () {
    const toolRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmToolsController')();

    toolRouter.route('tools/:toolId')
        .get(controller.fetchSingleTool);


    return toolRouter;
};

module.exports = routes;
