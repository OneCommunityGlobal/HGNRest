const express = require('express');

const router = express.Router();

const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  getOrderStats,
} = require('../../controllers/kitchenandinventory/orderController');

router.get('/stats', getOrderStats);

router.get('/', getOrders);

router.get('/:id', getOrderById);

router.post('/', createOrder);

router.put('/:id', updateOrder);

router.patch('/:id/status', updateOrderStatus);

router.delete('/:id', deleteOrder);

module.exports = router;
