const mongoose = require('mongoose');
const SeedOrder = require('../../models/gardenManagement/seedOrder');

const ORDER_STATUSES = new Set(['pending', 'received', 'cancelled']);

const sendServerError = (res, error) => {
  console.error(error);

  return res.status(500).json({
    message: 'Internal server error',
  });
};

/**
 * Validate order items.
 */
const validateItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return 'An order must contain at least one item';
  }

  for (const item of items) {
    if (!item || typeof item.name !== 'string' || !item.name.trim()) {
      return 'Each order item must have a name';
    }

    if (item.qty === undefined || Number.isNaN(Number(item.qty)) || Number(item.qty) < 1) {
      return 'Each order item quantity must be at least 1';
    }

    if (typeof item.unit !== 'string' || !item.unit.trim()) {
      return 'Each order item must have a unit';
    }
  }

  return null;
};

/**
 * Normalize order items before saving.
 */
const normalizeItems = (items) =>
  items.map((item) => ({
    name: item.name.trim(),
    qty: Number(item.qty),
    unit: item.unit.trim(),
  }));

/**
 * Validate an order ID.
 */
const validateOrderId = (orderId) => {
  if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
    return 'Order ID is required';
  }

  return null;
};

/**
 * Validate supplier.
 */
const validateSupplier = (supplier) => {
  if (!supplier || typeof supplier !== 'string' || !supplier.trim()) {
    return 'Supplier is required';
  }

  return null;
};

/**
 * Validate order status.
 */
const validateStatus = (status) => {
  if (!ORDER_STATUSES.has(status)) {
    return 'Invalid order status';
  }

  return null;
};

/**
 * Parse a date.
 */
const parseDate = (value, fieldName) => {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      error: `Invalid ${fieldName}`,
    };
  }

  return {
    value: parsedDate,
  };
};

/**
 * Validate delivery date against order date.
 */
const validateDeliveryDate = (deliveryDate, orderDate) => {
  if (deliveryDate && orderDate && deliveryDate < orderDate) {
    return 'Delivery date cannot be before order date';
  }

  return null;
};

/**
 * Validate create request fields.
 */
const validateCreateFields = ({ orderId, supplier, items, orderDate, status }) => {
  const orderIdError = validateOrderId(orderId);

  if (orderIdError) {
    return orderIdError;
  }

  const supplierError = validateSupplier(supplier);

  if (supplierError) {
    return supplierError;
  }

  const itemsError = validateItems(items);

  if (itemsError) {
    return itemsError;
  }

  if (!orderDate) {
    return 'Order date is required';
  }

  const statusError = validateStatus(status);

  if (statusError) {
    return statusError;
  }

  return null;
};

/**
 * Parse create order dates.
 */
const parseCreateDates = (orderDate, deliveryDate) => {
  const parsedOrderDate = parseDate(orderDate, 'order date');

  if (parsedOrderDate.error) {
    return {
      error: parsedOrderDate.error,
    };
  }

  if (!deliveryDate) {
    return {
      orderDate: parsedOrderDate.value,
      deliveryDate: undefined,
    };
  }

  const parsedDeliveryDate = parseDate(deliveryDate, 'delivery date');

  if (parsedDeliveryDate.error) {
    return {
      error: parsedDeliveryDate.error,
    };
  }

  const dateError = validateDeliveryDate(parsedDeliveryDate.value, parsedOrderDate.value);

  if (dateError) {
    return {
      error: dateError,
    };
  }

  return {
    orderDate: parsedOrderDate.value,
    deliveryDate: parsedDeliveryDate.value,
  };
};

/**
 * Build create order payload.
 */
const buildCreateOrder = ({ orderId, supplier, items, status, dates }) => ({
  orderId: orderId.trim(),
  supplier: supplier.trim(),
  items: normalizeItems(items),
  orderDate: dates.orderDate,
  deliveryDate: dates.deliveryDate,
  status,
});

/**
 * Validate update fields.
 */
const validateUpdateFields = (updates) => {
  if (updates.orderId !== undefined) {
    const error = validateOrderId(updates.orderId);

    if (error) {
      return error;
    }

    updates.orderId = updates.orderId.trim();
  }

  if (updates.supplier !== undefined) {
    const error = validateSupplier(updates.supplier);

    if (error) {
      return error;
    }

    updates.supplier = updates.supplier.trim();
  }

  if (updates.items !== undefined) {
    const error = validateItems(updates.items);

    if (error) {
      return error;
    }

    updates.items = normalizeItems(updates.items);
  }

  return null;
};

/**
 * Validate and parse update dates.
 */
const parseUpdateDates = (updates) => {
  if (updates.orderDate !== undefined) {
    const parsedOrderDate = parseDate(updates.orderDate, 'order date');

    if (parsedOrderDate.error) {
      return parsedOrderDate.error;
    }

    updates.orderDate = parsedOrderDate.value;
  }

  if (updates.deliveryDate !== undefined) {
    if (updates.deliveryDate === null || updates.deliveryDate === '') {
      updates.deliveryDate = undefined;
    } else {
      const parsedDeliveryDate = parseDate(updates.deliveryDate, 'delivery date');

      if (parsedDeliveryDate.error) {
        return parsedDeliveryDate.error;
      }

      updates.deliveryDate = parsedDeliveryDate.value;
    }
  }

  return null;
};

/**
 * Validate final order/delivery dates.
 */
const validateFinalDates = (updates, existingOrder) => {
  const finalOrderDate = updates.orderDate || existingOrder.orderDate;

  const finalDeliveryDate =
    updates.deliveryDate !== undefined ? updates.deliveryDate : existingOrder.deliveryDate;

  return validateDeliveryDate(finalDeliveryDate, finalOrderDate);
};

/**
 * GET all seed orders
 *
 * GET /api/kitchenandinventory/gardenmanagement/seed-orders
 */
const getSeedOrders = async (req, res) => {
  try {
    const orders = await SeedOrder.find().sort({ orderDate: -1 }).lean();

    return res.status(200).json(orders);
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * GET seed order by ID
 *
 * GET /api/kitchenandinventory/gardenmanagement/seed-orders/:id
 */
const getSeedOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid seed order ID',
      });
    }

    const order = await SeedOrder.findById(id).lean();

    if (!order) {
      return res.status(404).json({
        message: 'Seed order not found',
      });
    }

    return res.status(200).json(order);
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * CREATE seed order
 *
 * POST /api/kitchenandinventory/gardenmanagement/seed-orders
 */
const createSeedOrder = async (req, res) => {
  try {
    const { orderId, supplier, items, orderDate, deliveryDate, status = 'pending' } = req.body;

    const validationError = validateCreateFields({
      orderId,
      supplier,
      items,
      orderDate,
      status,
    });

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const dates = parseCreateDates(orderDate, deliveryDate);

    if (dates.error) {
      return res.status(400).json({
        message: dates.error,
      });
    }

    const order = await SeedOrder.create(
      buildCreateOrder({
        orderId,
        supplier,
        items,
        status,
        dates,
      }),
    );

    return res.status(201).json(order);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: 'Order ID already exists',
      });
    }

    return sendServerError(res, error);
  }
};

/**
 * UPDATE seed order
 *
 * PUT /api/kitchenandinventory/gardenmanagement/seed-orders/:id
 */
const updateSeedOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid seed order ID',
      });
    }

    const allowedFields = ['orderId', 'supplier', 'items', 'orderDate', 'deliveryDate', 'status'];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'No valid fields provided for update',
      });
    }

    const fieldError = validateUpdateFields(updates);

    if (fieldError) {
      return res.status(400).json({
        message: fieldError,
      });
    }

    const dateError = parseUpdateDates(updates);

    if (dateError) {
      return res.status(400).json({
        message: dateError,
      });
    }

    if (updates.status !== undefined && !ORDER_STATUSES.has(updates.status)) {
      return res.status(400).json({
        message: 'Invalid order status',
      });
    }

    const existingOrder = await SeedOrder.findById(id);

    if (!existingOrder) {
      return res.status(404).json({
        message: 'Seed order not found',
      });
    }

    const finalDateError = validateFinalDates(updates, existingOrder);

    if (finalDateError) {
      return res.status(400).json({
        message: finalDateError,
      });
    }

    const order = await SeedOrder.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json(order);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: 'Order ID already exists',
      });
    }

    return sendServerError(res, error);
  }
};

/**
 * DELETE seed order
 *
 * DELETE /api/kitchenandinventory/gardenmanagement/seed-orders/:id
 */
const deleteSeedOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid seed order ID',
      });
    }

    const order = await SeedOrder.findByIdAndDelete(id);

    if (!order) {
      return res.status(404).json({
        message: 'Seed order not found',
      });
    }

    return res.status(200).json({
      message: 'Seed order deleted successfully',
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * UPDATE seed order status
 *
 * PATCH /api/kitchenandinventory/gardenmanagement/seed-orders/:id/status
 */
const updateSeedOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid seed order ID',
      });
    }

    if (!ORDER_STATUSES.has(status)) {
      return res.status(400).json({
        message: 'Invalid order status',
      });
    }

    const order = await SeedOrder.findByIdAndUpdate(
      id,
      { status },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!order) {
      return res.status(404).json({
        message: 'Seed order not found',
      });
    }

    return res.status(200).json(order);
  } catch (error) {
    return sendServerError(res, error);
  }
};

module.exports = {
  getSeedOrders,
  getSeedOrderById,
  createSeedOrder,
  updateSeedOrder,
  deleteSeedOrder,
  updateSeedOrderStatus,
};
