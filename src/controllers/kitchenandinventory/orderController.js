const mongoose = require('mongoose');
const Order = require('../../models/kitchenandinventory/order');
const Supplier = require('../../models/kitchenandinventory/supplier');

const ORDER_STATUSES = new Set(['Pending', 'Ordered', 'Shipped', 'Delivered', 'Cancelled']);

const SUPPLIER_FIELDS = 'name email phone contact';
const SUPPLIER_FIELDS_WITH_WEBSITE = 'name email phone contact website';

const sendServerError = (res, message, error, logMessage) => {
  console.error(logMessage, error);

  return res.status(500).json({
    message,
  });
};

const getPopulatedOrder = (orderId) =>
  Order.findById(orderId).populate('supplierId', SUPPLIER_FIELDS);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * Validate a MongoDB ObjectId before using it in a query.
 * This prevents malformed/user-controlled values from reaching MongoDB.
 */
const isValidObjectId = (value) =>
  typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

/**
 * Convert a validated string to an ObjectId.
 */
const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const getOrders = async (req, res) => {
  try {
    const { search = '', status, supplierId } = req.query;

    /*
     * Only allow known status values.
     * Do not put an arbitrary value from req.query into the Mongo query.
     */
    const validStatus =
      typeof status === 'string' && status !== 'All' && ORDER_STATUSES.has(status)
        ? status
        : undefined;

    /*
     * Only use supplierId after validating that it is a valid MongoDB
     * ObjectId.
     */
    const validSupplierId =
      typeof supplierId === 'string' && isValidObjectId(supplierId)
        ? toObjectId(supplierId)
        : undefined;

    const query = {};

    if (validStatus) {
      query.status = validStatus;
    }

    if (validSupplierId) {
      query.supplierId = validSupplierId;
    }

    const trimmedSearch = typeof search === 'string' ? search.trim() : '';

    if (trimmedSearch) {
      const escapedSearch = escapeRegex(trimmedSearch);
      const searchRegex = new RegExp(escapedSearch, 'i');

      const suppliers = await Supplier.find({
        name: searchRegex,
      }).select('_id');

      const supplierIds = suppliers.map((supplier) => supplier._id);

      query.$or = [
        {
          supplierId: {
            $in: supplierIds,
          },
        },
        {
          'items.itemName': searchRegex,
        },
      ];
    }

    const orders = await Order.find(query)
      .populate('supplierId', SUPPLIER_FIELDS)
      .sort({ orderDate: -1 })
      .lean();

    return res.status(200).json(orders);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch orders', error, 'Error fetching orders:');
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findById(toObjectId(id)).populate(
      'supplierId',
      SUPPLIER_FIELDS_WITH_WEBSITE,
    );

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    return res.status(200).json(order);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch order', error, 'Error fetching order:');
  }
};

const createOrder = async (req, res) => {
  try {
    const { supplierId, orderDate, expectedDeliveryDate, items, status } = req.body;

    if (!supplierId) {
      return res.status(400).json({
        message: 'Supplier is required',
      });
    }

    if (!isValidObjectId(supplierId)) {
      return res.status(400).json({
        message: 'Invalid supplier ID',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'At least one order item is required',
      });
    }

    if (status !== undefined && !ORDER_STATUSES.has(status)) {
      return res.status(400).json({
        message: 'Invalid order status',
      });
    }

    const supplierObjectId = toObjectId(supplierId);

    const supplier = await Supplier.findById(supplierObjectId);

    if (!supplier) {
      return res.status(404).json({
        message: 'Supplier not found',
      });
    }

    if (!supplier.isActive) {
      return res.status(400).json({
        message: 'Cannot create an order for an inactive supplier',
      });
    }

    const order = await Order.create({
      supplierId: supplierObjectId,
      orderDate,
      expectedDeliveryDate,
      items,
      status: status || 'Pending',
    });

    const populatedOrder = await getPopulatedOrder(order._id);

    return res.status(201).json(populatedOrder);
  } catch (error) {
    return sendServerError(res, 'Failed to create order', error, 'Error creating order:');
  }
};

const updateOrder = async (req, res) => {
  try {
    const { supplierId, status, orderDate, expectedDeliveryDate, actualDeliveryDate, items } =
      req.body;

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    if (supplierId !== undefined && !isValidObjectId(supplierId)) {
      return res.status(400).json({
        message: 'Invalid supplier ID',
      });
    }

    if (status !== undefined && !ORDER_STATUSES.has(status)) {
      return res.status(400).json({
        message: 'Invalid order status',
      });
    }

    const order = await Order.findById(toObjectId(id));

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    if (supplierId !== undefined) {
      const supplier = await Supplier.findById(toObjectId(supplierId));

      if (!supplier) {
        return res.status(404).json({
          message: 'Supplier not found',
        });
      }

      order.supplierId = toObjectId(supplierId);
    }

    if (status !== undefined) {
      order.status = status;
    }

    if (orderDate !== undefined) {
      order.orderDate = orderDate;
    }

    if (expectedDeliveryDate !== undefined) {
      order.expectedDeliveryDate = expectedDeliveryDate;
    }

    if (actualDeliveryDate !== undefined) {
      order.actualDeliveryDate = actualDeliveryDate;
    }

    if (items !== undefined) {
      order.items = items;
    }

    await order.save();

    const populatedOrder = await getPopulatedOrder(order._id);

    return res.status(200).json(populatedOrder);
  } catch (error) {
    return sendServerError(res, 'Failed to update order', error, 'Error updating order:');
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!ORDER_STATUSES.has(status)) {
      return res.status(400).json({
        message: 'Invalid order status',
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findById(toObjectId(id));

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    const previousStatus = order.status;

    order.status = status;

    if (status === 'Delivered' && !order.actualDeliveryDate) {
      order.actualDeliveryDate = new Date();
    }

    await order.save();

    if (previousStatus === 'Pending' && status === 'Ordered') {
      await Supplier.findByIdAndUpdate(order.supplierId, {
        $inc: {
          totalOrders: 1,
        },
      });
    }

    const populatedOrder = await getPopulatedOrder(order._id);

    return res.status(200).json(populatedOrder);
  } catch (error) {
    return sendServerError(
      res,
      'Failed to update order status',
      error,
      'Error updating order status:',
    );
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findByIdAndDelete(toObjectId(id));

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    return res.status(200).json({
      message: 'Order deleted successfully',
    });
  } catch (error) {
    return sendServerError(res, 'Failed to delete order', error, 'Error deleting order:');
  }
};

const getOrderStats = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: {
            $sum: 1,
          },
          totalAmount: {
            $sum: '$totalAmount',
          },
        },
      },
    ]);

    const result = {
      totalOrders: 0,
      pending: 0,
      ordered: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      totalValue: 0,
    };

    const statusKeys = {
      Pending: 'pending',
      Ordered: 'ordered',
      Shipped: 'shipped',
      Delivered: 'delivered',
      Cancelled: 'cancelled',
    };

    stats.forEach((stat) => {
      result.totalOrders += stat.count;
      result.totalValue += stat.totalAmount || 0;

      const resultKey = statusKeys[stat._id];

      if (resultKey) {
        result[resultKey] = stat.count;
      }
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendServerError(
      res,
      'Failed to fetch order statistics',
      error,
      'Error fetching order statistics:',
    );
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  getOrderStats,
};
