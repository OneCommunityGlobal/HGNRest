const Order = require('../../models/kitchenandinventory/order');
const Supplier = require('../../models/kitchenandinventory/supplier');

const getOrders = async (req, res) => {
  try {
    const { search = '', status, supplierId } = req.query;

    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (supplierId) {
      query.supplierId = supplierId;
    }

    if (search.trim()) {
      const suppliers = await Supplier.find({
        name: new RegExp(search.trim(), 'i'),
      }).select('_id');

      const supplierIds = suppliers.map((supplier) => supplier._id);

      query.$or = [
        { supplierId: { $in: supplierIds } },
        { 'items.itemName': new RegExp(search.trim(), 'i') },
      ];
    }

    const orders = await Order.find(query)
      .populate('supplierId', 'name email phone contact')
      .sort({ orderDate: -1 })
      .lean();

    return res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);

    return res.status(500).json({
      message: 'Failed to fetch orders',
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      'supplierId',
      'name email phone contact website',
    );

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    return res.status(200).json(order);
  } catch (error) {
    console.error('Error fetching order:', error);

    return res.status(500).json({
      message: 'Failed to fetch order',
    });
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

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'At least one order item is required',
      });
    }

    const supplier = await Supplier.findById(supplierId);

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
      supplierId,
      orderDate,
      expectedDeliveryDate,
      items,
      status: status || 'Pending',
    });

    const populatedOrder = await Order.findById(order._id).populate(
      'supplierId',
      'name email phone contact',
    );

    return res.status(201).json(populatedOrder);
  } catch (error) {
    console.error('Error creating order:', error);

    return res.status(500).json({
      message: 'Failed to create order',
    });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { supplierId, status, orderDate, expectedDeliveryDate, actualDeliveryDate, items } =
      req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    if (supplierId !== undefined) {
      const supplier = await Supplier.findById(supplierId);

      if (!supplier) {
        return res.status(404).json({
          message: 'Supplier not found',
        });
      }

      order.supplierId = supplierId;
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

    const populatedOrder = await Order.findById(order._id).populate(
      'supplierId',
      'name email phone contact',
    );

    return res.status(200).json(populatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);

    return res.status(500).json({
      message: 'Failed to update order',
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = ['Pending', 'Ordered', 'Shipped', 'Delivered', 'Cancelled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid order status',
      });
    }

    const order = await Order.findById(req.params.id);

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

    // Increment supplier totalOrders only when
    // the order changes from Pending to Ordered.
    if (previousStatus === 'Pending' && status === 'Ordered') {
      await Supplier.findByIdAndUpdate(order.supplierId, {
        $inc: {
          totalOrders: 1,
        },
      });
    }

    const populatedOrder = await Order.findById(order._id).populate(
      'supplierId',
      'name email phone contact',
    );

    return res.status(200).json(populatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);

    return res.status(500).json({
      message: 'Failed to update order status',
    });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    await Order.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      message: 'Order deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting order:', error);

    return res.status(500).json({
      message: 'Failed to delete order',
    });
  }
};

const getOrderStats = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
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

    stats.forEach((stat) => {
      result.totalOrders += stat.count;
      result.totalValue += stat.totalAmount || 0;

      switch (stat._id) {
        case 'Pending':
          result.pending = stat.count;
          break;
        case 'Ordered':
          result.ordered = stat.count;
          break;
        case 'Shipped':
          result.shipped = stat.count;
          break;
        case 'Delivered':
          result.delivered = stat.count;
          break;
        case 'Cancelled':
          result.cancelled = stat.count;
          break;
        default:
          break;
      }
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching order statistics:', error);

    return res.status(500).json({
      message: 'Failed to fetch order statistics',
    });
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
