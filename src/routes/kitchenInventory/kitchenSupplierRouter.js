const express = require('express');

const routes = function () {
  const controller = require('../../controllers/kitchenInventory/kitchenSupplierController')();
  const kitchenSupplierRouter = express.Router();

  kitchenSupplierRouter
    .route('/suppliers')
    .get(controller.getSuppliers)
    .post(controller.createSupplier);
  kitchenSupplierRouter
    .route('/suppliers/:supplierId')
    .get(controller.getSupplierById)
    .put(controller.updateSupplier)
    .delete(controller.deleteSupplier);

  return kitchenSupplierRouter;
};

module.exports = routes;
