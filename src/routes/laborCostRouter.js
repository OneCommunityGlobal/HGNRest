const express = require("express")

const routes = (LaborCost) => {
  const laborCostRouter = express.Router()
  const controller = require("../controllers/laborCostController")(LaborCost)

  // Only keep the POST endpoint for adding labor costs
  laborCostRouter.route("/").post(controller.addLaborCost)

  return laborCostRouter
}

module.exports = routes
