const express = require('express');

const routes = function (SupplierPerformance) {
  const controller = require('../../controllers/summaryDashboard/supplierPerformance')(SupplierPerformance);
  const supplierPerformanceRouter = express.Router();

  // Route to get supplier performance for a project in a specific date range
  supplierPerformanceRouter.route('/performance')
    .get(controller.getSupplierPerformance);

  // Route to add a new supplier performance record
  supplierPerformanceRouter.route('/performance')
    .post(controller.postSupplierPerformance);

  // Route to delete all supplier performance records for a specific project
  supplierPerformanceRouter.route('/performance/:projectId')
    .delete(controller.deleteSupplierPerformanceByProject);

  return supplierPerformanceRouter;
};

module.exports = routes;
