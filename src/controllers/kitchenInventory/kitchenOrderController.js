/* eslint-disable max-lines-per-function */
const mongoose = require('mongoose');
const logger = require('../../startup/logger');
const Supplier = require('../../models/kitchenInventory/supplier');
const Order = require('../../models/kitchenInventory/order');
const getValidationErrorMessage = require('./validationErrorMessage');

// Mirrors the order item schema: itemName required, quantity >= 1, pricePerItem >= 0.
const getOrderItemError = (item, index) => {
  const label = `Item ${index + 1}`;
  if (!item || typeof item !== 'object') {
    return `${label}: invalid order item`;
  }
  if (typeof item.itemName !== 'string' || !item.itemName.trim()) {
    return `${label}: itemName is required`;
  }
  if (typeof item.quantity !== 'number' || item.quantity < 1) {
    return `${label}: quantity must be a number of at least 1`;
  }
  if (typeof item.pricePerItem !== 'number' || item.pricePerItem < 0) {
    return `${label}: pricePerItem must be a number of at least 0`;
  }
  return null;
};

const findInactiveOrMissingSupplier = async (supplierId) => {
  const supplier = await Supplier.findById(new mongoose.Types.ObjectId(String(supplierId)));
  return !supplier || !supplier.isActive;
};

const validateOrderItems = (items) => {
  if (items === undefined) {
    return null;
  }

  if (!Array.isArray(items)) {
    return { error: 'Invalid items' };
  }

  const itemError = items.map(getOrderItemError).find(Boolean);
  if (itemError) {
    return { error: itemError };
  }

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.pricePerItem, 0);

  return { items, totalAmount };
};

// Only the fields that were sent are updated; empty values are ignored.
const buildOrderUpdate = ({
  supplierId,
  status,
  orderDate,
  expectedDeliveryDate,
  actualDeliveryDate,
}) => {
  const update = {};
  if (supplierId) {
    update.supplierId = new mongoose.Types.ObjectId(String(supplierId));
  }
  if (status) {
    update.status = String(status);
  }
  Object.entries({ orderDate, expectedDeliveryDate, actualDeliveryDate }).forEach(
    ([field, value]) => {
      if (value) {
        update[field] = value;
      }
    },
  );
  return update;
};

const kitchenOrderController = function () {
  // POST /orders/{id}
  const createOrder = async (req, res) => {
    try {
      const { supplierId, status, orderDate, expectedDeliveryDate, actualDeliveryDate, items } =
        req.body;

      if (!supplierId || !mongoose.Types.ObjectId.isValid(String(supplierId))) {
        return res.status(400).json({ message: 'Invalid Supplier id' });
      }

      const allowedStatuses = Order.schema.path('status').enumValues;

      if (status && !allowedStatuses.includes(String(status))) {
        return res.status(400).json({ message: 'Invalid order status' });
      }

      if (await findInactiveOrMissingSupplier(supplierId)) {
        return res.status(400).json({ message: 'Supplier Not Found' });
      }

      const validatedItems = validateOrderItems(items);

      if (validatedItems?.error) {
        return res.status(400).json({ message: validatedItems.error });
      }

      const orderData = {
        supplierId: new mongoose.Types.ObjectId(String(supplierId)),
      };

      if (status !== undefined) {
        orderData.status = String(status);
      }

      if (orderDate !== undefined) {
        orderData.orderDate = orderDate;
      }

      if (expectedDeliveryDate !== undefined) {
        orderData.expectedDeliveryDate = expectedDeliveryDate;
      }

      if (actualDeliveryDate !== undefined) {
        orderData.actualDeliveryDate = actualDeliveryDate;
      }

      if (validatedItems) {
        orderData.items = validatedItems.items;
      }

      const order = new Order(orderData);

      const saved = await order.save();
      res.status(201).json(saved);
    } catch (err) {
      const validationMessage = getValidationErrorMessage(err);
      if (validationMessage) {
        return res.status(400).json({ message: validationMessage });
      }
      logger.logException(err);
      res.status(400).json({ err: 'Unable to create order' });
    }
  };

  // GET /orders
  const getOrders = async (req, res) => {
    try {
      const { supplierId, status } = req.query;

      if (supplierId && !mongoose.Types.ObjectId.isValid(String(supplierId))) {
        return res.status(400).send({ message: 'Invalid Supplier Id' });
      }

      const allowedStatuses = Order.schema.path('status').enumValues;

      if (status && !allowedStatuses.includes(String(status))) {
        return res.status(400).send({ message: 'Invalid order status' });
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
      logger.logException(err);
      res.status(500).json({ err: 'Internal server error' });
    }
  };

  // GET /order/{id}
  const getOrderById = async (req, res) => {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).send({ message: 'Invalid order id' });
    }

    try {
      const order = await Order.findById(new mongoose.Types.ObjectId(String(orderId)));

      if (!order) {
        return res.status(404).json({ message: 'Order Not Found' });
      }

      res.status(200).json(order);
    } catch (err) {
      logger.logException(err);
      res.status(500).json({ err: 'Internal server error' });
    }
  };

  // PUT /order/{id}
  const updateOrder = async (req, res) => {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).send({ message: 'Invalid order id' });
    }

    try {
      const { supplierId, status, orderDate, expectedDeliveryDate, actualDeliveryDate, items } =
        req.body;

      if (supplierId && !mongoose.Types.ObjectId.isValid(String(supplierId))) {
        return res.status(400).send({ message: 'Invalid Supplier id' });
      }

      const allowedStatuses = Order.schema.path('status').enumValues;

      if (status && !allowedStatuses.includes(String(status))) {
        return res.status(400).send({ message: 'Invalid order status' });
      }

      const validatedItems = validateOrderItems(items);

      if (validatedItems?.error) {
        return res.status(400).json({ message: validatedItems.error });
      }

      if (supplierId && (await findInactiveOrMissingSupplier(supplierId))) {
        return res.status(400).json({ message: 'Supplier Not Found' });
      }

      const update = buildOrderUpdate({
        supplierId,
        status,
        orderDate,
        expectedDeliveryDate,
        actualDeliveryDate,
      });

      if (validatedItems) {
        update.items = validatedItems.items;
        update.totalAmount = validatedItems.totalAmount;
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
        return res.status(404).json({ message: 'Order Not Found' });
      }

      res.status(200).send(updated);
    } catch (err) {
      const validationMessage = getValidationErrorMessage(err);
      if (validationMessage) {
        return res.status(400).json({ message: validationMessage });
      }
      logger.logException(err);
      res.status(400).json({ err: 'Unable to update order' });
    }
  };

  // DELETE /order/{id}
  const deleteOrder = async (req, res) => {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).json({ message: 'Invalid Order Id' });
    }

    try {
      const removed = await Order.findByIdAndDelete(new mongoose.Types.ObjectId(String(orderId)));

      if (!removed) {
        return res.status(404).json({ message: 'Order Not Found' });
      }

      res.status(200).json({ message: 'Deleted' });
    } catch (err) {
      logger.logException(err);
      res.status(500).json({ err: 'Internal server error' });
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
