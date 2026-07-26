const express = require('express');

const routes = () => {
  const costsRouter = express.Router();
  const controller = require('../controllers/costsController')();

  // Static routes MUST come before parameterized routes
  costsRouter.route('/breakdown').get(controller.getCostBreakdown);

  costsRouter.route('/refresh').post(controller.refreshCosts);

  costsRouter.route('/').post(controller.addCostEntry);

  costsRouter.route('/:costId').put(controller.updateCostEntry).delete(controller.deleteCostEntry);

  costsRouter.route('/project/:projectId').get(controller.getCostsByProject);

  return costsRouter;
};

module.exports = routes;
