const express = require('express');

const routes = function (BuildingTool, ToolType) {
    const toolRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmToolController')(BuildingTool, ToolType);
    
    toolRouter.route('/tools/:toolId')
        .get(controller.fetchSingleTool);

    toolRouter.route('/tools/purchase')
        .post(controller.bmPurchaseTools);

    toolRouter.route('/tools/log')
        .post(controller.bmLogTools);

    return toolRouter;
};

module.exports = routes;
