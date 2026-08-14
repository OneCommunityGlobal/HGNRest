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
        _id: 'order1',
        supplierId: 'supplier1',
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

    it('should filter orders by status', async () => {
      req.query = {
        status: 'Pending',
      };

      const orderQuery = createOrderQuery();

      jest.spyOn(Order, 'find').mockReturnValue(orderQuery);

      await getOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({
        status: 'Pending',
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should not filter by status when status is All', async () => {
      req.query = {
        status: 'All',
      };

      const orderQuery = createOrderQuery();

      jest.spyOn(Order, 'find').mockReturnValue(orderQuery);

      await getOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({});

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should filter orders by supplierId', async () => {
      req.query = {
        supplierId: 'supplier123',
      };

      const orderQuery = createOrderQuery();

      jest.spyOn(Order, 'find').mockReturnValue(orderQuery);

      await getOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({
        supplierId: 'supplier123',
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should apply both status and supplier filters', async () => {
      req.query = {
        status: 'Ordered',
        supplierId: 'supplier123',
      };

      const orderQuery = createOrderQuery();

      jest.spyOn(Order, 'find').mockReturnValue(orderQuery);

      await getOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({
        status: 'Ordered',
        supplierId: 'supplier123',
      });
    });

    it('should search orders by supplier name and item name', async () => {
      const suppliers = [
        {
          _id: 'supplier1',
        },
        {
          _id: 'supplier2',
        },
      ];

      const supplierSelect = jest.fn().mockResolvedValue(suppliers);

      jest.spyOn(Supplier, 'find').mockReturnValue({
        select: supplierSelect,
      });

      const orderQuery = createOrderQuery();

      jest.spyOn(Order, 'find').mockReturnValue(orderQuery);

      req.query = {
        search: 'Rice',
      };

      await getOrders(req, res);

      expect(Supplier.find).toHaveBeenCalled();

      const supplierSearchQuery = Supplier.find.mock.calls[0][0];

      expect(supplierSearchQuery.name).toBeInstanceOf(RegExp);
      expect(supplierSearchQuery.name.flags).toContain('i');

      expect(supplierSelect).toHaveBeenCalledWith('_id');

      expect(Order.find).toHaveBeenCalledWith({
        $or: [
          {
            supplierId: {
              $in: ['supplier1', 'supplier2'],
            },
          },
          {
            'items.itemName': expect.any(RegExp),
          },
        ],
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    it('should trim whitespace from search', async () => {
      const supplierSelect = jest.fn().mockResolvedValue([]);

      jest.spyOn(Supplier, 'find').mockReturnValue({
        select: supplierSelect,
      });

      const orderQuery = createOrderQuery();

      jest.spyOn(Order, 'find').mockReturnValue(orderQuery);

      req.query = {
        search: '   Rice   ',
      };

      await getOrders(req, res);

      const supplierSearchQuery = Supplier.find.mock.calls[0][0];

      expect(supplierSearchQuery.name).toEqual(/Rice/i);
    });

    it('should escape regex special characters in search', async () => {
      const supplierSelect = jest.fn().mockResolvedValue([]);

      jest.spyOn(Supplier, 'find').mockReturnValue({
        select: supplierSelect,
      });

      const orderQuery = createOrderQuery();

      jest.spyOn(Order, 'find').mockReturnValue(orderQuery);

      req.query = {
        search: 'Rice.*+?',
      };

      await getOrders(req, res);

      const supplierSearchQuery = Supplier.find.mock.calls[0][0];
      const regex = supplierSearchQuery.name;

      expect(regex).toBeInstanceOf(RegExp);

      // The special regex characters should be escaped.
      expect(regex.source).toContain('\\.');
      expect(regex.source).toContain('\\*');
      expect(regex.source).toContain('\\+');
      expect(regex.source).toContain('\\?');
    });

    it('should handle an empty search string', async () => {
      const orderQuery = createOrderQuery();

      jest.spyOn(Order, 'find').mockReturnValue(orderQuery);
      jest.spyOn(Supplier, 'find');

      req.query = {
        search: '',
      };

      await getOrders(req, res);

      expect(Supplier.find).not.toHaveBeenCalled();

      expect(Order.find).toHaveBeenCalledWith({});
    });

    it('should handle a whitespace-only search string', async () => {
      const orderQuery = createOrderQuery();

      jest.spyOn(Order, 'find').mockReturnValue(orderQuery);
      jest.spyOn(Supplier, 'find');

      req.query = {
        search: '     ',
      };

      await getOrders(req, res);

      expect(Supplier.find).not.toHaveBeenCalled();

      expect(Order.find).toHaveBeenCalledWith({});
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

    it('should return 500 when supplier search fails', async () => {
      const error = new Error('Supplier search failed');

      jest.spyOn(Supplier, 'find').mockImplementation(() => {
        throw error;
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      req.query = {
        search: 'Rice',
      };

      await getOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to fetch orders',
      });
    });
  });

  describe('getOrderById', () => {
    it('should return an order when found', async () => {
      const mockOrder = {
        _id: 'order1',
        status: 'Pending',
      };

      const populate = jest.fn().mockResolvedValue(mockOrder);

      jest.spyOn(Order, 'findById').mockReturnValue({
        populate,
      });

      req.params.id = 'order1';

      await getOrderById(req, res);

      expect(Order.findById).toHaveBeenCalledWith('order1');

      expect(populate).toHaveBeenCalledWith('supplierId', 'name email phone contact website');

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrder);
    });

    it('should return 404 when order is not found', async () => {
      const populate = jest.fn().mockResolvedValue(null);

      jest.spyOn(Order, 'findById').mockReturnValue({
        populate,
      });

      req.params.id = 'missing-order';

      await getOrderById(req, res);

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

      req.params.id = 'order1';

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
      supplierId: 'supplier1',
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

    it('should return 404 when supplier does not exist', async () => {
      jest.spyOn(Supplier, 'findById').mockResolvedValue(null);
      jest.spyOn(Order, 'create');

      await createOrder(req, res);

      expect(Supplier.findById).toHaveBeenCalledWith('supplier1');
      expect(Order.create).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Supplier not found',
      });
    });

    it('should return 400 when supplier is inactive', async () => {
      jest.spyOn(Supplier, 'findById').mockResolvedValue({
        _id: 'supplier1',
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
        _id: 'supplier1',
        isActive: true,
      };

      const createdOrder = {
        _id: 'order1',
      };

      const populatedOrder = {
        _id: 'order1',
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

      expect(Supplier.findById).toHaveBeenCalledWith('supplier1');

      expect(Order.create).toHaveBeenCalledWith({
        supplierId: 'supplier1',
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

      expect(Order.findById).toHaveBeenCalledWith('order1');

      expect(populate).toHaveBeenCalledWith('supplierId', 'name email phone contact');

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(populatedOrder);
    });

    it('should default status to Pending when status is missing', async () => {
      delete req.body.status;

      const supplier = {
        _id: 'supplier1',
        isActive: true,
      };

      const createdOrder = {
        _id: 'order1',
      };

      jest.spyOn(Supplier, 'findById').mockResolvedValue(supplier);

      jest.spyOn(Order, 'create').mockResolvedValue(createdOrder);

      jest.spyOn(Order, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(createdOrder),
      });

      await createOrder(req, res);

      expect(Order.create).toHaveBeenCalledWith(
        expect.objectContaining({
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
        _id: 'supplier1',
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
      _id: 'order1',
      supplierId: 'oldSupplier',
      status: 'Pending',
      orderDate: '2026-08-01',
      expectedDeliveryDate: '2026-08-10',
      actualDeliveryDate: undefined,
      items: [],
      save: jest.fn().mockResolvedValue(true),
    });

    it('should return 404 when order does not exist', async () => {
      jest.spyOn(Order, 'findById').mockResolvedValue(null);

      req.params.id = 'missing-order';

      await updateOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Order not found',
      });
    });

    it('should return 404 when new supplier does not exist', async () => {
      const order = createMockOrder();

      jest.spyOn(Order, 'findById').mockResolvedValue(order);

      jest.spyOn(Supplier, 'findById').mockResolvedValue(null);

      req.params.id = 'order1';

      req.body = {
        supplierId: 'newSupplier',
      };

      await updateOrder(req, res);

      expect(Supplier.findById).toHaveBeenCalledWith('newSupplier');

      expect(order.save).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Supplier not found',
      });
    });

    it('should update supplier successfully', async () => {
      const order = createMockOrder();

      const supplier = {
        _id: 'newSupplier',
      };

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      jest.spyOn(Supplier, 'findById').mockResolvedValue(supplier);

      req.params.id = 'order1';

      req.body = {
        supplierId: 'newSupplier',
      };

      await updateOrder(req, res);

      expect(order.supplierId).toBe('newSupplier');

      expect(order.save).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update all optional fields', async () => {
      const order = createMockOrder();

      const supplier = {
        _id: 'newSupplier',
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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      jest.spyOn(Supplier, 'findById').mockResolvedValue(supplier);

      req.params.id = 'order1';

      req.body = {
        supplierId: 'newSupplier',
        status: 'Shipped',
        orderDate: '2026-08-05',
        expectedDeliveryDate: '2026-08-15',
        actualDeliveryDate: '2026-08-14',
        items,
      };

      await updateOrder(req, res);

      expect(order.supplierId).toBe('newSupplier');
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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      req.params.id = 'order1';

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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      req.params.id = 'order1';

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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      req.params.id = 'order1';

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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      req.params.id = 'order1';

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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      req.params.id = 'order1';

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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      req.params.id = 'order1';

      req.body = {};

      await updateOrder(req, res);

      expect(order.save).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 when finding the order fails', async () => {
      const error = new Error('Database error');

      jest.spyOn(Order, 'findById').mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      req.params.id = 'order1';

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

      req.params.id = 'order1';

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
      _id: 'order1',
      status,
      actualDeliveryDate: undefined,
      supplierId: 'supplier1',
      save: jest.fn().mockResolvedValue(true),
    });

    it('should return 400 for an invalid status', async () => {
      jest.spyOn(Order, 'findById');

      req.params.id = 'order1';

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

    it('should update status successfully', async () => {
      const order = createMockOrder('Pending');

      jest
        .spyOn(Order, 'findById')
        .mockResolvedValueOnce(order)
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      req.params.id = 'order1';

      req.body = {
        status: 'Shipped',
      };

      await updateOrderStatus(req, res);

      expect(order.status).toBe('Shipped');

      expect(order.save).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when order does not exist', async () => {
      jest.spyOn(Order, 'findById').mockResolvedValue(null);

      req.params.id = 'missing-order';

      req.body = {
        status: 'Shipped',
      };

      await updateOrderStatus(req, res);

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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      req.params.id = 'order1';

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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      req.params.id = 'order1';

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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      req.params.id = 'order1';

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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      jest.spyOn(Supplier, 'findByIdAndUpdate').mockResolvedValue({});

      req.params.id = 'order1';

      req.body = {
        status: 'Ordered',
      };

      await updateOrderStatus(req, res);

      expect(Supplier.findByIdAndUpdate).toHaveBeenCalledWith('supplier1', {
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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      jest.spyOn(Supplier, 'findByIdAndUpdate');

      req.params.id = 'order1';

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

      req.params.id = 'order1';

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

      req.params.id = 'order1';

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
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(order),
        });

      jest.spyOn(Supplier, 'findByIdAndUpdate').mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      req.params.id = 'order1';

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
        _id: 'order1',
      };

      jest.spyOn(Order, 'findByIdAndDelete').mockResolvedValue(order);

      req.params.id = 'order1';

      await deleteOrder(req, res);

      expect(Order.findByIdAndDelete).toHaveBeenCalledWith('order1');

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Order deleted successfully',
      });
    });

    it('should return 404 when order does not exist', async () => {
      jest.spyOn(Order, 'findByIdAndDelete').mockResolvedValue(null);

      req.params.id = 'missing-order';

      await deleteOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Order not found',
      });
    });

    it('should return 500 when deleting order fails', async () => {
      const error = new Error('Delete error');

      jest.spyOn(Order, 'findByIdAndDelete').mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      req.params.id = 'order1';

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
