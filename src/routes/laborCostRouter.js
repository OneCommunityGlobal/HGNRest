const express = require("express")

const routes = (LaborCost) => {
  const laborCostRouter = express.Router()
  const controller = require("../controllers/laborCostController")(LaborCost)

  laborCostRouter.route("/").get(controller.getLaborCosts).post(controller.addLaborCost)

  laborCostRouter.route("/:laborCostId").put(controller.updateLaborCost).delete(controller.deleteLaborCost)

  laborCostRouter.route("/project/:projectName").get(controller.getLaborCostsByProject)

  return laborCostRouter
}

module.exports = routes
