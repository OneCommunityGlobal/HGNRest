const express = require('express');

const routes = function (BuildingTool) {
    const toolRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmToolController')(BuildingTool);

    toolRouter.route('/tools/:toolId')
        .get(controller.fetchSingleTool);

    return toolRouter;
};

module.exports = routes;
