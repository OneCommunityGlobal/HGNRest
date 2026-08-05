/* eslint-disable max-lines-per-function */
const mongoose = require('mongoose');
const Supplier = require('../../models/kitchenInventory/supplier');
const Order = require('../../models/kitchenInventory/order');

const kitchenOrderController = function () {
  // POST /orders/{id}
  const createOrder = async (req, res) => {
    try {
      const { supplierId, status, orderDate, expectedDeliveryDate, actualDeliveryDate, items } =
        req.body;

      if (!supplierId || !mongoose.Types.ObjectId.isValid(String(supplierId))) {
        return res.status(400).json('Invalid Supplier id');
      }

      const allowedStatuses = Order.schema.path('status').enumValues;

      if (status && !allowedStatuses.includes(String(status))) {
        return res.status(400).json('Invalid order status');
      }

      const supplier = await Supplier.findById(new mongoose.Types.ObjectId(String(supplierId)));

      if (!supplier || !supplier.isActive) {
        return res.status(400).json('Supplier Not Found');
      }

      const order = new Order({
        supplierId: new mongoose.Types.ObjectId(String(supplierId)),
        ...(status && { status: String(status) }),
        ...(orderDate && { orderDate }),
        ...(expectedDeliveryDate && { expectedDeliveryDate }),
        ...(actualDeliveryDate && { actualDeliveryDate }),
        ...(items && { items }),
      });

      const saved = await order.save();
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json(err);
    }
  };

  // GET /orders
  const getOrders = async (req, res) => {
    try {
      const { supplierId, status } = req.query;

      if (supplierId && !mongoose.Types.ObjectId.isValid(String(supplierId))) {
        return res.status(400).send('Invalid Supplier Id');
      }

      const allowedStatuses = Order.schema.path('status').enumValues;

      if (status && !allowedStatuses.includes(String(status))) {
        return res.status(400).send('Invalid order status');
      }

      const query = {};

      if (supplierId) {
        query.supplierId = new mongoose.Types.ObjectId(String(supplierId));
      }

      if (status) {
        query.status = String(status);
      }

      const results = await Order.find(query)
        .populate({
          path: 'supplierId',
          select: 'name email phone',
        })
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

    if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).send('Invalid order id');
    }

    try {
      const order = await Order.findById(new mongoose.Types.ObjectId(String(orderId)));

      if (!order) {
        return res.status(404).json('Order Not Found');
      }

      res.status(200).json(order);
    } catch (err) {
      res.status(500).send(err);
    }
  };

  // PUT /order/{id}
  const updateOrder = async (req, res) => {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).send('Invalid order id');
    }

    try {
      const { supplierId, status, orderDate, expectedDeliveryDate, actualDeliveryDate, items } =
        req.body;

      if (supplierId && !mongoose.Types.ObjectId.isValid(String(supplierId))) {
        return res.status(400).send('Invalid Supplier id');
      }

      const allowedStatuses = Order.schema.path('status').enumValues;

      if (status && !allowedStatuses.includes(String(status))) {
        return res.status(400).send('Invalid order status');
      }

      const update = {};

      if (supplierId) {
        update.supplierId = new mongoose.Types.ObjectId(String(supplierId));
      }

      if (status) {
        update.status = String(status);
      }

      if (orderDate) {
        update.orderDate = orderDate;
      }

      if (expectedDeliveryDate) {
        update.expectedDeliveryDate = expectedDeliveryDate;
      }

      if (actualDeliveryDate) {
        update.actualDeliveryDate = actualDeliveryDate;
      }

      if (items) {
        update.items = items;
        update.totalAmount = items.reduce(
          (sum, item) => sum + item.quantity * item.pricePerItem,
          0,
        );
      }

      const updated = await Order.findByIdAndUpdate(
        new mongoose.Types.ObjectId(String(orderId)),
        update,
        {
          new: true,
          runValidators: true,
        },
      );

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

    if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).json('Invalid Order Id');
    }

    try {
      const removed = await Order.findByIdAndDelete(new mongoose.Types.ObjectId(String(orderId)));

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
