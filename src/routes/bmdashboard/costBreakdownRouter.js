const express = require('express');
const router = express.Router();

module.exports = function(costBreakdown) {
  // Import the controller and pass the costBreakdown model
  const costBreakdownController = require('../../controllers/bmdashboard/costBreakdownController')(costBreakdown);
  
  // Define routes and map them to controller methods
  router.get('/projects/:id/actual-cost-breakdown', costBreakdownController.getActualCostBreakdown);
  
  // Add new route for getting all expenditures
  router.get('/expenditures', costBreakdownController.getAllExpenditure);
  
  return router;
};