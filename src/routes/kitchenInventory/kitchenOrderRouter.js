const express = require('express');

const routes = function () {
  const controller = require('../../controllers/kitchenInventory/kitchenOrderController')();
  const kitchenOrderRouter = express.Router();

  kitchenOrderRouter.route('/orders').get(controller.getOrders).post(controller.createOrder);
  kitchenOrderRouter
    .route('/orders/:orderId')
    .get(controller.getOrderById)
    .put(controller.updateOrder)
    .delete(controller.deleteOrder);

  return kitchenOrderRouter;
};

module.exports = routes;
