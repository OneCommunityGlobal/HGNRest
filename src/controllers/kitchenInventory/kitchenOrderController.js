/* eslint-disable max-lines-per-function */
const mongoose = require('mongoose');
const Supplier = require('../../models/kitchenInventory/supplier');
const Order = require('../../models/kitchenInventory/order');

const kitchenOrderController = function () {
  // POST /orders/{id}
  const createOrder = async (req, res) => {
    try {
      const { supplierId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(supplierId)) {
        return res.status(400).json('Invalid Supplier id');
      }

      const supplier = await Supplier.findById(supplierId);

      if (!supplier || !supplier.isActive) {
        return res.status(400).json('Supplier Not Found');
      }

      const order = new Order(req.body);
      const saved = await order.save();
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json(err);
    }
  };

  // GET /orders
  const getOrders = async (req, res) => {
    try {
      const filter = {};

      if (req.query.supplierId) {
        if (!mongoose.Types.ObjectId.isValid(req.query.supplierId)) {
          return res.status(400).send('Invalid Supplier Id');
        }
        filter.supplierId = mongoose.Types.ObjectId(req.query.supplierId);
      }

      if (req.query.status) {
        filter.status = req.query.status;
      }

      const results = await Order.find(filter)
        .populate({ path: 'supplierId', select: 'name email phone' })
        .sort({ orderDate: -1 })
        .lean();
      res.status(200).send(results);
    } catch (err) {
      res.status(500).send(err);
    }
  };

  // GET /order/{id}
  const getOrderById = async (req, res) => {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).send('Invalid order id');
    }

    try {
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json('Order Not Found');
      }

      res.status(200).json(order);
    } catch (err) {
      res.status(500).send(err);
    }
  };

  // PUT /supplier/{id}
  const updateOrder = async (req, res) => {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).send('Invalid order id');
    }

    try {
      if (req.body.items && req.body.items.length > 0) {
        req.body.totalAmount = req.body.items.reduce(
          (sum, item) => sum + item.quantity * item.pricePerItem,
          0,
        );
      }
      const updated = await Order.findByIdAndUpdate(orderId, req.body, { new: true });
      if (!updated) {
        return res.status(404).json('Order Not Found');
      }
      res.status(200).send(updated);
    } catch (err) {
      res.status(400).json(err);
    }
  };

  // DELETE /order/{id}
  const deleteOrder = async (req, res) => {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      res.status(400).json('Invalid Order Id');
    }

    try {
      const removed = await Order.findByIdAndDelete(orderId);
      if (!removed) {
        return res.status(404).json('Order Not Found');
      }
      res.status(200).json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json(err);
    }
  };

  return {
    createOrder,
    getOrders,
    getOrderById,
    updateOrder,
    deleteOrder,
  };
};

module.exports = kitchenOrderController;
