const express = require("express");

const routes = function (Costs) {
    const costsRouter = express.Router();
    const controller = require("../controllers/costsController")(Costs);

    costsRouter.route("/breakdown")
        .get(controller.getCostBreakdown);

    costsRouter.route("/")
        .post(controller.addCostEntry);

    costsRouter.route("/:costId")
        .put(controller.updateCostEntry)
        .delete(controller.deleteCostEntry);

    costsRouter.route("/:projectId")
        .get(controller.getCostsByProject);

    return costsRouter;
};

module.exports = routes;