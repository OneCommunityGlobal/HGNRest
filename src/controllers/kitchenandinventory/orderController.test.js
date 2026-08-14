const mongoose = require('mongoose');
const Order = require('../../models/kitchenandinventory/order');
const Supplier = require('../../models/kitchenandinventory/supplier');
const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  getOrderStats,
} = require('./orderController');

const VALID_ORDER_ID = '507f1f77bcf86cd799439011';
const VALID_SUPPLIER_ID = '507f1f77bcf86cd799439012';
const NEW_SUPPLIER_ID = '507f1f77bcf86cd799439013';
const MISSING_ORDER_ID = '507f1f77bcf86cd799439014';

const validOrderObjectId = new mongoose.Types.ObjectId(VALID_ORDER_ID);
const validSupplierObjectId = new mongoose.Types.ObjectId(VALID_SUPPLIER_ID);
const newSupplierObjectId = new mongoose.Types.ObjectId(NEW_SUPPLIER_ID);
const missingOrderObjectId = new mongoose.Types.ObjectId(MISSING_ORDER_ID);

describe('Order Controller', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      query: {},
      params: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getOrders', () => {
    const mockOrders = [
      {
        _id: VALID_ORDER_ID,
        supplierId: VALID_SUPPLIER_ID,
        status: 'Pending',
      },
    ];

    const createOrderQuery = (orders = mockOrders) => ({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(orders),
    });

    it('should return all orders successfully', async () => {
      const orderQuery = createOrderQuery();

      jest.spyOn(Order, 'find').mockReturnValue(orderQuery);

      await getOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({});

      expect(orderQuery.populate).toHaveBeenCalledWith('supplierId', 'name email phone contact');

      expect(orderQuery.sort).toHaveBeenCalledWith({
        orderDate: -1,
      });

      expect(orderQuery.lean).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    it('should ignore query parameters and still return all orders', async () => {
      const orderQuery = createOrderQuery();

      jest.spyOn(Order, 'find').mockReturnValue(orderQuery);

      req.query = {
        search: 'Rice',
        status: 'Pending',
        supplierId: VALID_SUPPLIER_ID,
      };

      await getOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({});

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    it('should return 500 when fetching orders fails', async () => {
      const error = new Error('Database error');

      jest.spyOn(Order, 'find').mockImplementation(() => {
        throw error;
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getOrders(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching orders:', error);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to fetch orders',
      });
    });
  });

  describe('getOrderById', () => {
    it('should return an order when found', async () => {
      const mockOrder = {
        _id: VALID_ORDER_ID,
        status: 'Pending',
      };

      const populate = jest.fn().mockResolvedValue(mockOrder);

      jest.spyOn(Order, 'findById').mockReturnValue({
        populate,
      });

      req.params.id = VALID_ORDER_ID;

      await getOrderById(req, res);

      expect(Order.findById).toHaveBeenCalledWith(validOrderObjectId);

      expect(populate).toHaveBeenCalledWith('supplierId', 'name email phone contact website');

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrder);
    });

    it('should return 400 when order ID is invalid', async () => {
      jest.spyOn(Order, 'findById');

      req.params.id = 'invalid-id';

      await getOrderById(req, res);

      expect(Order.findById).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid order ID',
      });
    });

    it('should return 404 when order is not found', async () => {
      const populate = jest.fn().mockResolvedValue(null);

      jest.spyOn(Order, 'findById').mockReturnValue({
        populate,
      });

      req.params.id = MISSING_ORDER_ID;

      await getOrderById(req, res);

      expect(Order.findById).toHaveBeenCalledWith(missingOrderObjectId);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Order not found',
      });
    });

    it('should return 500 when fetching order fails', async () => {
      const error = new Error('Database error');

      jest.spyOn(Order, 'findById').mockReturnValue({
        populate: jest.fn().mockRejectedValue(error),
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      req.params.id = VALID_ORDER_ID;

      await getOrderById(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching order:', error);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to fetch order',
      });
    });
  });

  describe('createOrder', () => {
    const validBody = {
      supplierId: VALID_SUPPLIER_ID,
      orderDate: '2026-08-13',
      expectedDeliveryDate: '2026-08-20',
      items: [
        {
          itemName: 'Rice',
          quantity: 10,
        },
      ],
      status: 'Ordered',
    };

    beforeEach(() => {
      req.body = {
        ...validBody,
      };
    });

    it('should return 400 when supplierId is missing', async () => {
      jest.spyOn(Supplier, 'findById');
      jest.spyOn(Order, 'create');

      delete req.body.supplierId;

      await createOrder(req, res);

      expect(Supplier.findById).not.toHaveBeenCalled();
      expect(Order.create).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Supplier is required',
      });
    });

    it('should return 400 when supplierId is invalid', async () => {
      jest.spyOn(Supplier, 'findById');
      jest.spyOn(Order, 'create');

      req.body.supplierId = 'invalid-supplier-id';

      await createOrder(req, res);

      expect(Supplier.findById).not.toHaveBeenCalled();
      expect(Order.create).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid supplier ID',
      });
    });

    it('should return 400 when items is not an array', async () => {
      jest.spyOn(Order, 'create');

      req.body.items = 'Rice';

      await createOrder(req, res);

      expect(Order.create).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'At least one order item is required',
      });
    });

    it('should return 400 when items array is empty', async () => {
      jest.spyOn(Order, 'create');

      req.body.items = [];

      await createOrder(req, res);

      expect(Order.create).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'At least one order item is required',
      });
    });

    it('should return 400 when status is invalid', async () => {
      jest.spyOn(Order, 'create');
      jest.spyOn(Supplier, 'findById');

      req.body.status = 'InvalidStatus';

      await createOrder(req, res);

      expect(Supplier.findById).not.toHaveBeenCalled();
      expect(Order.create).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid order status',
      });
    });

    it('should return 404 when supplier does not exist', async () => {
      jest.spyOn(Supplier, 'findById').mockResolvedValue(null);
      jest.spyOn(Order, 'create');

      await createOrder(req, res);

      expect(Supplier.findById).toHaveBeenCalledWith(validSupplierObjectId);

      expect(Order.create).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Supplier not found',
      });
    });

    it('should return 400 when supplier is inactive', async () => {
      jest.spyOn(Supplier, 'findById').mockResolvedValue({
        _id: validSupplierObjectId,
        isActive: false,
      });

      jest.spyOn(Order, 'create');

      await createOrder(req, res);

      expect(Order.create).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Cannot create an order for an inactive supplier',
      });
    });

    it('should create an order successfully', async () => {
      const supplier = {
        _id: validSupplierObjectId,
        isActive: true,
      };

      const createdOrder = {
        _id: validOrderObjectId,
      };

      const populatedOrder = {
        _id: validOrderObjectId,
        supplierId: supplier,
        status: 'Ordered',
      };

      jest.spyOn(Supplier, 'findById').mockResolvedValue(supplier);

      jest.spyOn(Order, 'create').mockResolvedValue(createdOrder);

      const populate = jest.fn().mockResolvedValue(populatedOrder);

      jest.spyOn(Order, 'findById').mockReturnValue({
        populate,
      });

      await createOrder(req, res);

      expect(Supplier.findById).toHaveBeenCalledWith(validSupplierObjectId);

      expect(Order.create).toHaveBeenCalledWith({
        supplierId: validSupplierObjectId,
        orderDate: '2026-08-13',
        expectedDeliveryDate: '2026-08-20',
        items: [
          {
            itemName: 'Rice',
            quantity: 10,
          },
        ],
        status: 'Ordered',
      });

      expect(Order.findById).toHaveBeenCalledWith(validOrderObjectId);

      expect(populate).toHaveBeenCalledWith('supplierId', 'name email phone contact');

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(populatedOrder);
    });

    it('should default status to Pending when status is missing', async () => {
      delete req.body.status;

      const supplier = {
        _id: validSupplierObjectId,
        isActive: true,
      };

      const createdOrder = {
        _id: validOrderObjectId,
      };

      jest.spyOn(Supplier, 'findById').mockResolvedValue(supplier);

      jest.spyOn(Order, 'create').mockResolvedValue(createdOrder);

      jest.spyOn(Order, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(createdOrder),
      });

      await createOrder(req, res);

      expect(Order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: validSupplierObjectId,
          status: 'Pending',
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 500 when creating an order fails', async () => {
      const error = new Error('Create error');

      jest.spyOn(Supplier, 'findById').mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await createOrder(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error creating order:', error);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to create order',
      });
    });

    it('should return 500 when order creation itself fails', async () => {
      const error = new Error('Order creation failed');

      jest.spyOn(Supplier, 'findById').mockResolvedValue({
        _id: validSupplierObjectId,
        isActive: true,
      });

      jest.spyOn(Order, 'create').mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to create order',
      });
    });
  });

  describe('updateOrder', () => {
    const createMockOrder = () => ({
      _id: validOrderObjectId,
      supplierId: validSupplierObjectId,
      status: 'Pending',
      orderDate: '2026-08-01',
      expectedDeliveryDate: '2026-08-10',
      actualDeliveryDate: undefined,
      items: [],
      save: jest.fn().mockResolvedValue(true),
    });

    const mockPopulatedOrder = (order) => ({
      populate: jest.fn().mockResolvedValue(order),
    });

    it('should return 400 for an invalid order ID', async () => {
      jest.spyOn(Order, 'findById');

      req.params.id = 'invalid-id';

      await updateOrder(req, res);

      expect(Order.findById).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid order ID',
      });
    });

    it('should return 404 when order does not exist', async () => {
      jest.spyOn(Order, 'findById').mockResolvedValue(null);

      req.params.id = MISSING_ORDER_ID;

      await updateOrder(req, res);

      expect(Order.findById).toHaveBeenCalledWith(missingOrderObjectId);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Order not found',
      });
    });

    it('should return 400 when new supplier ID is invalid', async () => {
      jest.spyOn(Order, 'findById');

      req.params.id = VALID_ORDER_ID;

      req.body = {
        supplierId: 'invalid-supplier-id',
      };

      await updateOrder(req, res);

      expect(Order.findById).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid supplier ID',
      });
    });

    it('should return 400 when status is invalid', async () => {
      jest.spyOn(Order, 'findById');

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'InvalidStatus',
      };

      await updateOrder(req, res);

      expect(Order.findById).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid order status',
      });
    });

    it('should return 404 when new supplier does not exist', async () => {
      const order = createMockOrder();

      jest.spyOn(Order, 'findById').mockResolvedValue(order);

      jest.spyOn(Supplier, 'findById').mockResolvedValue(null);

      req.params.id = VALID_ORDER_ID;

      req.body = {
        supplierId: NEW_SUPPLIER_ID,
      };

      await updateOrder(req, res);

      expect(Supplier.findById).toHaveBeenCalledWith(newSupplierObjectId);

      expect(order.save).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Supplier not found',
      });
    });

    it('should update supplier successfully', async () => {
      const order = createMockOrder();

      const supplier = {
        _id: newSupplierObjectId,
      };

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      jest.spyOn(Supplier, 'findById').mockResolvedValue(supplier);

      req.params.id = VALID_ORDER_ID;

      req.body = {
        supplierId: NEW_SUPPLIER_ID,
      };

      await updateOrder(req, res);

      expect(order.supplierId).toEqual(newSupplierObjectId);
      expect(order.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update all optional fields', async () => {
      const order = createMockOrder();

      const supplier = {
        _id: newSupplierObjectId,
      };

      const items = [
        {
          itemName: 'Beans',
          quantity: 5,
        },
      ];

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      jest.spyOn(Supplier, 'findById').mockResolvedValue(supplier);

      req.params.id = VALID_ORDER_ID;

      req.body = {
        supplierId: NEW_SUPPLIER_ID,
        status: 'Shipped',
        orderDate: '2026-08-05',
        expectedDeliveryDate: '2026-08-15',
        actualDeliveryDate: '2026-08-14',
        items,
      };

      await updateOrder(req, res);

      expect(order.supplierId).toEqual(newSupplierObjectId);
      expect(order.status).toBe('Shipped');
      expect(order.orderDate).toBe('2026-08-05');
      expect(order.expectedDeliveryDate).toBe('2026-08-15');
      expect(order.actualDeliveryDate).toBe('2026-08-14');
      expect(order.items).toEqual(items);

      expect(order.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update status when provided', async () => {
      const order = createMockOrder();

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'Delivered',
      };

      await updateOrder(req, res);

      expect(order.status).toBe('Delivered');
      expect(order.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update orderDate when provided', async () => {
      const order = createMockOrder();

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      req.params.id = VALID_ORDER_ID;

      req.body = {
        orderDate: '2026-08-20',
      };

      await updateOrder(req, res);

      expect(order.orderDate).toBe('2026-08-20');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update expectedDeliveryDate when provided', async () => {
      const order = createMockOrder();

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      req.params.id = VALID_ORDER_ID;

      req.body = {
        expectedDeliveryDate: '2026-08-25',
      };

      await updateOrder(req, res);

      expect(order.expectedDeliveryDate).toBe('2026-08-25');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update actualDeliveryDate when provided', async () => {
      const order = createMockOrder();

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      req.params.id = VALID_ORDER_ID;

      req.body = {
        actualDeliveryDate: '2026-08-20',
      };

      await updateOrder(req, res);

      expect(order.actualDeliveryDate).toBe('2026-08-20');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update items when provided', async () => {
      const order = createMockOrder();

      const items = [
        {
          itemName: 'Flour',
          quantity: 20,
        },
      ];

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      req.params.id = VALID_ORDER_ID;

      req.body = {
        items,
      };

      await updateOrder(req, res);

      expect(order.items).toEqual(items);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should successfully update without optional fields', async () => {
      const order = createMockOrder();

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      req.params.id = VALID_ORDER_ID;
      req.body = {};

      await updateOrder(req, res);

      expect(order.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 when finding the order fails', async () => {
      const error = new Error('Database error');

      jest.spyOn(Order, 'findById').mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      req.params.id = VALID_ORDER_ID;

      await updateOrder(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error updating order:', error);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to update order',
      });
    });

    it('should return 500 when saving the order fails', async () => {
      const error = new Error('Save error');

      const order = createMockOrder();

      order.save.mockRejectedValue(error);

      jest.spyOn(Order, 'findById').mockResolvedValue(order);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'Shipped',
      };

      await updateOrder(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error updating order:', error);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to update order',
      });
    });
  });

  describe('updateOrderStatus', () => {
    const createMockOrder = (status = 'Pending') => ({
      _id: validOrderObjectId,
      status,
      actualDeliveryDate: undefined,
      supplierId: validSupplierObjectId,
      save: jest.fn().mockResolvedValue(true),
    });

    const mockPopulatedOrder = (order) => ({
      populate: jest.fn().mockResolvedValue(order),
    });

    it('should return 400 for an invalid status', async () => {
      jest.spyOn(Order, 'findById');

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'InvalidStatus',
      };

      await updateOrderStatus(req, res);

      expect(Order.findById).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid order status',
      });
    });

    it('should return 400 for an invalid order ID', async () => {
      jest.spyOn(Order, 'findById');

      req.params.id = 'invalid-id';

      req.body = {
        status: 'Shipped',
      };

      await updateOrderStatus(req, res);

      expect(Order.findById).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid order ID',
      });
    });

    it('should update status successfully', async () => {
      const order = createMockOrder('Pending');

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'Shipped',
      };

      await updateOrderStatus(req, res);

      expect(Order.findById).toHaveBeenCalledWith(validOrderObjectId);

      expect(order.status).toBe('Shipped');
      expect(order.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when order does not exist', async () => {
      jest.spyOn(Order, 'findById').mockResolvedValue(null);

      req.params.id = MISSING_ORDER_ID;

      req.body = {
        status: 'Shipped',
      };

      await updateOrderStatus(req, res);

      expect(Order.findById).toHaveBeenCalledWith(missingOrderObjectId);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Order not found',
      });
    });

    it('should set actualDeliveryDate when order becomes Delivered', async () => {
      const order = createMockOrder('Shipped');

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'Delivered',
      };

      await updateOrderStatus(req, res);

      expect(order.status).toBe('Delivered');
      expect(order.actualDeliveryDate).toBeInstanceOf(Date);
      expect(order.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should not replace an existing actualDeliveryDate', async () => {
      const existingDate = new Date('2026-08-10');

      const order = {
        ...createMockOrder('Shipped'),
        actualDeliveryDate: existingDate,
      };

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'Delivered',
      };

      await updateOrderStatus(req, res);

      expect(order.actualDeliveryDate).toBe(existingDate);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should not set actualDeliveryDate for non-Delivered status', async () => {
      const order = createMockOrder('Pending');

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'Shipped',
      };

      await updateOrderStatus(req, res);

      expect(order.actualDeliveryDate).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should increment supplier totalOrders when moving Pending to Ordered', async () => {
      const order = createMockOrder('Pending');

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      jest.spyOn(Supplier, 'findByIdAndUpdate').mockResolvedValue({});

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'Ordered',
      };

      await updateOrderStatus(req, res);

      expect(Supplier.findByIdAndUpdate).toHaveBeenCalledWith(validSupplierObjectId, {
        $inc: {
          totalOrders: 1,
        },
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should not increment supplier totalOrders for other status transitions', async () => {
      const order = createMockOrder('Shipped');

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      jest.spyOn(Supplier, 'findByIdAndUpdate');

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'Delivered',
      };

      await updateOrderStatus(req, res);

      expect(Supplier.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 500 when updating order status fails', async () => {
      const error = new Error('Status update error');

      jest.spyOn(Order, 'findById').mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'Shipped',
      };

      await updateOrderStatus(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error updating order status:', error);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to update order status',
      });
    });

    it('should return 500 when saving the order status fails', async () => {
      const error = new Error('Save error');

      const order = createMockOrder('Pending');

      order.save.mockRejectedValue(error);

      jest.spyOn(Order, 'findById').mockResolvedValue(order);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'Ordered',
      };

      await updateOrderStatus(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error updating order status:', error);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to update order status',
      });
    });

    it('should return 500 when updating supplier totalOrders fails', async () => {
      const error = new Error('Supplier update error');

      const order = createMockOrder('Pending');

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce(mockPopulatedOrder(order));

      jest.spyOn(Supplier, 'findByIdAndUpdate').mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      req.params.id = VALID_ORDER_ID;

      req.body = {
        status: 'Ordered',
      };

      await updateOrderStatus(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error updating order status:', error);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to update order status',
      });
    });
  });

  describe('deleteOrder', () => {
    it('should delete an order successfully', async () => {
      const order = {
        _id: validOrderObjectId,
      };

      jest.spyOn(Order, 'findByIdAndDelete').mockResolvedValue(order);

      req.params.id = VALID_ORDER_ID;

      await deleteOrder(req, res);

      expect(Order.findByIdAndDelete).toHaveBeenCalledWith(validOrderObjectId);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Order deleted successfully',
      });
    });

    it('should return 400 for an invalid order ID', async () => {
      jest.spyOn(Order, 'findByIdAndDelete');

      req.params.id = 'invalid-id';

      await deleteOrder(req, res);

      expect(Order.findByIdAndDelete).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid order ID',
      });
    });

    it('should return 404 when order does not exist', async () => {
      jest.spyOn(Order, 'findByIdAndDelete').mockResolvedValue(null);

      req.params.id = MISSING_ORDER_ID;

      await deleteOrder(req, res);

      expect(Order.findByIdAndDelete).toHaveBeenCalledWith(missingOrderObjectId);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Order not found',
      });
    });

    it('should return 500 when deleting order fails', async () => {
      const error = new Error('Delete error');

      jest.spyOn(Order, 'findByIdAndDelete').mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      req.params.id = VALID_ORDER_ID;

      await deleteOrder(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error deleting order:', error);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to delete order',
      });
    });
  });

  describe('getOrderStats', () => {
    it('should return statistics for all order statuses', async () => {
      const stats = [
        {
          _id: 'Pending',
          count: 5,
          totalAmount: 100,
        },
        {
          _id: 'Ordered',
          count: 4,
          totalAmount: 200,
        },
        {
          _id: 'Shipped',
          count: 3,
          totalAmount: 300,
        },
        {
          _id: 'Delivered',
          count: 2,
          totalAmount: 400,
        },
        {
          _id: 'Cancelled',
          count: 1,
          totalAmount: 50,
        },
      ];

      jest.spyOn(Order, 'aggregate').mockResolvedValue(stats);

      await getOrderStats(req, res);

      expect(Order.aggregate).toHaveBeenCalledWith([
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

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        totalOrders: 15,
        pending: 5,
        ordered: 4,
        shipped: 3,
        delivered: 2,
        cancelled: 1,
        totalValue: 1050,
      });
    });

    it('should return zero statistics when there are no orders', async () => {
      jest.spyOn(Order, 'aggregate').mockResolvedValue([]);

      await getOrderStats(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        totalOrders: 0,
        pending: 0,
        ordered: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        totalValue: 0,
      });
    });

    it('should handle an unknown status', async () => {
      jest.spyOn(Order, 'aggregate').mockResolvedValue([
        {
          _id: 'Unknown',
          count: 3,
          totalAmount: 100,
        },
      ]);

      await getOrderStats(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        totalOrders: 3,
        pending: 0,
        ordered: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        totalValue: 100,
      });
    });

    it('should treat missing totalAmount as zero', async () => {
      jest.spyOn(Order, 'aggregate').mockResolvedValue([
        {
          _id: 'Pending',
          count: 2,
          totalAmount: null,
        },
      ]);

      await getOrderStats(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        totalOrders: 2,
        pending: 2,
        ordered: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        totalValue: 0,
      });
    });

    it('should handle multiple statistics including zero totalAmount', async () => {
      jest.spyOn(Order, 'aggregate').mockResolvedValue([
        {
          _id: 'Pending',
          count: 2,
          totalAmount: 100,
        },
        {
          _id: 'Shipped',
          count: 1,
          totalAmount: 0,
        },
      ]);

      await getOrderStats(req, res);

      expect(res.json).toHaveBeenCalledWith({
        totalOrders: 3,
        pending: 2,
        ordered: 0,
        shipped: 1,
        delivered: 0,
        cancelled: 0,
        totalValue: 100,
      });
    });

    it('should return 500 when fetching statistics fails', async () => {
      const error = new Error('Aggregation error');

      jest.spyOn(Order, 'aggregate').mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getOrderStats(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching order statistics:', error);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to fetch order statistics',
      });
    });
  });
});
