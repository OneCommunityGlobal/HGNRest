const mongoose = require('mongoose');
const SeedOrder = require('../../../models/gardenManagement/seedOrder');
const {
  getSeedOrders,
  getSeedOrderById,
  createSeedOrder,
  updateSeedOrder,
  deleteSeedOrder,
  updateSeedOrderStatus,
} = require('../seedOrderController');

const validId = new mongoose.Types.ObjectId().toString();

const createResponse = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
};

const createFindChain = (result) => ({
  sort: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(result),
  }),
});

const createFindByIdChain = (result) => ({
  lean: jest.fn().mockResolvedValue(result),
});

const validItems = [
  {
    name: 'Tomato Seeds',
    qty: 10,
    unit: 'packets',
  },
];

const validOrderBody = {
  orderId: 'ORD-001',
  supplier: 'Garden Supplier',
  items: validItems,
  orderDate: '2026-08-15',
  deliveryDate: '2026-08-20',
  status: 'pending',
};

describe('Seed Order Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('getSeedOrders', () => {
    test.each([
      ['search', { search: 'tomato' }],
      ['supplier', { supplier: 'Garden' }],
      ['status', { status: 'pending' }],
      [
        'search, supplier and status',
        {
          search: 'tomato',
          supplier: 'Garden',
          status: 'received',
        },
      ],
    ])('should return orders when using %s filters', async (_description, query) => {
      const req = { query };
      const res = createResponse();

      const orders = [
        {
          orderId: 'ORD-001',
          supplier: 'Garden Supplier',
        },
      ];

      jest.spyOn(SeedOrder, 'find').mockReturnValue(createFindChain(orders));

      await getSeedOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(orders);
    });

    test('should return all orders without filters', async () => {
      const req = {
        query: {},
      };
      const res = createResponse();

      const orders = [
        {
          orderId: 'ORD-001',
        },
      ];

      const findSpy = jest.spyOn(SeedOrder, 'find').mockReturnValue(createFindChain(orders));

      await getSeedOrders(req, res);

      expect(findSpy).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(orders);
    });

    test('should escape regex characters in search', async () => {
      const req = {
        query: {
          search: 'tomato.*',
        },
      };
      const res = createResponse();

      const findSpy = jest.spyOn(SeedOrder, 'find').mockReturnValue(createFindChain([]));

      await getSeedOrders(req, res);

      const query = findSpy.mock.calls[0][0];

      expect(query.$or[0].orderId.$regex).toBe('tomato\\.\\*');
    });

    test('should accept All status without filtering', async () => {
      const req = {
        query: {
          status: 'All',
        },
      };
      const res = createResponse();

      const findSpy = jest.spyOn(SeedOrder, 'find').mockReturnValue(createFindChain([]));

      await getSeedOrders(req, res);

      expect(findSpy).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('should reject invalid status', async () => {
      const req = {
        query: {
          status: 'invalid',
        },
      };
      const res = createResponse();

      const findSpy = jest.spyOn(SeedOrder, 'find');

      await getSeedOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid order status',
      });

      expect(findSpy).not.toHaveBeenCalled();
    });

    test('should return 500 when database query fails', async () => {
      const req = {
        query: {},
      };
      const res = createResponse();

      jest.spyOn(SeedOrder, 'find').mockImplementation(() => {
        throw new Error('Database error');
      });

      await getSeedOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  describe('getSeedOrderById', () => {
    test('should return order by valid ID', async () => {
      const req = {
        params: {
          id: validId,
        },
      };
      const res = createResponse();

      const order = {
        _id: validId,
        orderId: 'ORD-001',
      };

      jest.spyOn(SeedOrder, 'findById').mockReturnValue(createFindByIdChain(order));

      await getSeedOrderById(req, res);

      expect(SeedOrder.findById).toHaveBeenCalledWith(validId);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(order);
    });

    test('should reject invalid ID', async () => {
      const req = {
        params: {
          id: 'invalid-id',
        },
      };
      const res = createResponse();

      const findByIdSpy = jest.spyOn(SeedOrder, 'findById');

      await getSeedOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid seed order ID',
      });

      expect(findByIdSpy).not.toHaveBeenCalled();
    });

    test('should return 404 when order is not found', async () => {
      const req = {
        params: {
          id: validId,
        },
      };
      const res = createResponse();

      jest.spyOn(SeedOrder, 'findById').mockReturnValue(createFindByIdChain(null));

      await getSeedOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Seed order not found',
      });
    });

    test('should return 500 when database query fails', async () => {
      const req = {
        params: {
          id: validId,
        },
      };
      const res = createResponse();

      jest.spyOn(SeedOrder, 'findById').mockImplementation(() => {
        throw new Error('Database error');
      });

      await getSeedOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  describe('createSeedOrder', () => {
    test('should create seed order successfully', async () => {
      const req = {
        body: validOrderBody,
      };
      const res = createResponse();

      const createdOrder = {
        _id: validId,
        ...validOrderBody,
      };

      jest.spyOn(SeedOrder, 'create').mockResolvedValue(createdOrder);

      await createSeedOrder(req, res);

      expect(SeedOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ORD-001',
          supplier: 'Garden Supplier',
          status: 'pending',
          items: [
            {
              name: 'Tomato Seeds',
              qty: 10,
              unit: 'packets',
            },
          ],
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdOrder);
    });

    test.each([
      [
        'missing order ID',
        {
          ...validOrderBody,
          orderId: '',
        },
        'Order ID is required',
      ],
      [
        'missing supplier',
        {
          ...validOrderBody,
          supplier: '',
        },
        'Supplier is required',
      ],
      [
        'missing items',
        {
          ...validOrderBody,
          items: [],
        },
        'An order must contain at least one item',
      ],
      [
        'missing order date',
        {
          ...validOrderBody,
          orderDate: '',
        },
        'Order date is required',
      ],
      [
        'invalid status',
        {
          ...validOrderBody,
          status: 'invalid',
        },
        'Invalid order status',
      ],
    ])('should reject %s', async (_description, body, message) => {
      const req = { body };
      const res = createResponse();

      const createSpy = jest.spyOn(SeedOrder, 'create');

      await createSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message,
      });

      expect(createSpy).not.toHaveBeenCalled();
    });

    test.each([
      [
        'item without name',
        [
          {
            qty: 10,
            unit: 'packets',
          },
        ],
        'Each order item must have a name',
      ],
      [
        'item with invalid quantity',
        [
          {
            name: 'Tomato',
            qty: 0,
            unit: 'packets',
          },
        ],
        'Each order item quantity must be at least 1',
      ],
      [
        'item without unit',
        [
          {
            name: 'Tomato',
            qty: 10,
            unit: '',
          },
        ],
        'Each order item must have a unit',
      ],
    ])('should reject %s', async (_description, items, message) => {
      const req = {
        body: {
          ...validOrderBody,
          items,
        },
      };

      const res = createResponse();

      const createSpy = jest.spyOn(SeedOrder, 'create');

      await createSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message,
      });

      expect(createSpy).not.toHaveBeenCalled();
    });

    test.each([
      [
        'invalid order date',
        {
          ...validOrderBody,
          orderDate: 'invalid-date',
        },
        'Invalid order date',
      ],
      [
        'invalid delivery date',
        {
          ...validOrderBody,
          deliveryDate: 'invalid-date',
        },
        'Invalid delivery date',
      ],
      [
        'delivery date before order date',
        {
          ...validOrderBody,
          orderDate: '2026-08-20',
          deliveryDate: '2026-08-15',
        },
        'Delivery date cannot be before order date',
      ],
    ])('should reject %s', async (_description, body, message) => {
      const req = { body };
      const res = createResponse();

      const createSpy = jest.spyOn(SeedOrder, 'create');

      await createSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message,
      });

      expect(createSpy).not.toHaveBeenCalled();
    });

    test('should use pending as default status', async () => {
      const req = {
        body: {
          ...validOrderBody,
          status: undefined,
        },
      };

      const res = createResponse();

      jest.spyOn(SeedOrder, 'create').mockResolvedValue({
        orderId: 'ORD-001',
      });

      await createSeedOrder(req, res);

      expect(SeedOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('should allow order without delivery date', async () => {
      const req = {
        body: {
          ...validOrderBody,
          deliveryDate: undefined,
        },
      };

      const res = createResponse();

      jest.spyOn(SeedOrder, 'create').mockResolvedValue({
        orderId: 'ORD-001',
      });

      await createSeedOrder(req, res);

      expect(SeedOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryDate: undefined,
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('should return 409 for duplicate order ID', async () => {
      const req = {
        body: validOrderBody,
      };

      const res = createResponse();

      jest.spyOn(SeedOrder, 'create').mockRejectedValue({
        code: 11000,
      });

      await createSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Order ID already exists',
      });
    });

    test('should return 500 when create fails', async () => {
      const req = {
        body: validOrderBody,
      };

      const res = createResponse();

      jest.spyOn(SeedOrder, 'create').mockRejectedValue(new Error('Database error'));

      await createSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  describe('updateSeedOrder', () => {
    const updateRequest = (body) => ({
      params: {
        id: validId,
      },
      body,
    });

    test('should update seed order successfully', async () => {
      const req = updateRequest({
        supplier: ' Updated Supplier ',
        status: 'received',
      });

      const res = createResponse();

      const existingOrder = {
        _id: validId,
        orderDate: new Date('2026-08-10'),
        deliveryDate: new Date('2026-08-15'),
      };

      const updatedOrder = {
        ...existingOrder,
        supplier: 'Updated Supplier',
        status: 'received',
      };

      jest.spyOn(SeedOrder, 'findById').mockResolvedValue(existingOrder);

      jest.spyOn(SeedOrder, 'findByIdAndUpdate').mockResolvedValue(updatedOrder);

      await updateSeedOrder(req, res);

      expect(SeedOrder.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        expect.objectContaining({
          supplier: 'Updated Supplier',
          status: 'received',
        }),
        {
          new: true,
          runValidators: true,
        },
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedOrder);
    });

    test('should reject invalid ID', async () => {
      const req = {
        params: {
          id: 'invalid-id',
        },
        body: {
          supplier: 'Supplier',
        },
      };

      const res = createResponse();

      await updateSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid seed order ID',
      });
    });

    test('should reject empty update', async () => {
      const req = updateRequest({});
      const res = createResponse();

      const findSpy = jest.spyOn(SeedOrder, 'findById');

      await updateSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No valid fields provided for update',
      });

      expect(findSpy).not.toHaveBeenCalled();
    });

    test.each([
      [
        'invalid order ID',
        {
          orderId: '',
        },
        'Order ID is required',
      ],
      [
        'invalid supplier',
        {
          supplier: '',
        },
        'Supplier is required',
      ],
      [
        'invalid status',
        {
          status: 'invalid',
        },
        'Invalid order status',
      ],
      [
        'invalid order date',
        {
          orderDate: 'invalid-date',
        },
        'Invalid order date',
      ],
      [
        'invalid delivery date',
        {
          deliveryDate: 'invalid-date',
        },
        'Invalid delivery date',
      ],
    ])('should reject %s', async (_description, body, message) => {
      const req = updateRequest(body);
      const res = createResponse();

      await updateSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message,
      });
    });

    test.each([
      ['empty items', [], 'An order must contain at least one item'],
      [
        'item without name',
        [
          {
            qty: 2,
            unit: 'packets',
          },
        ],
        'Each order item must have a name',
      ],
      [
        'item with invalid quantity',
        [
          {
            name: 'Tomato',
            qty: 0,
            unit: 'packets',
          },
        ],
        'Each order item quantity must be at least 1',
      ],
      [
        'item without unit',
        [
          {
            name: 'Tomato',
            qty: 2,
            unit: '',
          },
        ],
        'Each order item must have a unit',
      ],
    ])('should reject %s', async (_description, items, message) => {
      const req = updateRequest({
        items,
      });

      const res = createResponse();

      await updateSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message,
      });
    });

    test('should normalize update items', async () => {
      const req = updateRequest({
        items: [
          {
            name: ' Tomato Seeds ',
            qty: '5',
            unit: ' packets ',
          },
        ],
      });

      const res = createResponse();

      jest.spyOn(SeedOrder, 'findById').mockResolvedValue({
        orderDate: new Date('2026-08-10'),
      });

      jest.spyOn(SeedOrder, 'findByIdAndUpdate').mockResolvedValue({
        orderId: 'ORD-001',
      });

      await updateSeedOrder(req, res);

      expect(SeedOrder.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        expect.objectContaining({
          items: [
            {
              name: 'Tomato Seeds',
              qty: 5,
              unit: 'packets',
            },
          ],
        }),
        {
          new: true,
          runValidators: true,
        },
      );
    });

    test('should allow clearing delivery date', async () => {
      const req = updateRequest({
        deliveryDate: '',
      });

      const res = createResponse();

      jest.spyOn(SeedOrder, 'findById').mockResolvedValue({
        orderDate: new Date('2026-08-10'),
      });

      jest.spyOn(SeedOrder, 'findByIdAndUpdate').mockResolvedValue({
        orderId: 'ORD-001',
      });

      await updateSeedOrder(req, res);

      expect(SeedOrder.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        expect.objectContaining({
          deliveryDate: undefined,
        }),
        {
          new: true,
          runValidators: true,
        },
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('should return 404 when existing order is not found', async () => {
      const req = updateRequest({
        supplier: 'New Supplier',
      });

      const res = createResponse();

      jest.spyOn(SeedOrder, 'findById').mockResolvedValue(null);

      const updateSpy = jest.spyOn(SeedOrder, 'findByIdAndUpdate');

      await updateSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Seed order not found',
      });

      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should reject delivery date before order date', async () => {
      const req = updateRequest({
        deliveryDate: '2026-08-01',
      });

      const res = createResponse();

      jest.spyOn(SeedOrder, 'findById').mockResolvedValue({
        orderDate: new Date('2026-08-10'),
      });

      const updateSpy = jest.spyOn(SeedOrder, 'findByIdAndUpdate');

      await updateSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Delivery date cannot be before order date',
      });

      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should return 409 for duplicate order ID', async () => {
      const req = updateRequest({
        orderId: 'ORD-999',
      });

      const res = createResponse();

      jest.spyOn(SeedOrder, 'findById').mockResolvedValue({
        orderDate: new Date('2026-08-10'),
      });

      jest.spyOn(SeedOrder, 'findByIdAndUpdate').mockRejectedValue({
        code: 11000,
      });

      await updateSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Order ID already exists',
      });
    });

    test('should return 500 when update fails', async () => {
      const req = updateRequest({
        supplier: 'New Supplier',
      });

      const res = createResponse();

      jest.spyOn(SeedOrder, 'findById').mockResolvedValue({
        orderDate: new Date('2026-08-10'),
      });

      jest.spyOn(SeedOrder, 'findByIdAndUpdate').mockRejectedValue(new Error('Database error'));

      await updateSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  describe('deleteSeedOrder', () => {
    test('should delete seed order successfully', async () => {
      const req = {
        params: {
          id: validId,
        },
      };

      const res = createResponse();

      jest.spyOn(SeedOrder, 'findByIdAndDelete').mockResolvedValue({
        _id: validId,
      });

      await deleteSeedOrder(req, res);

      expect(SeedOrder.findByIdAndDelete).toHaveBeenCalledWith(validId);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Seed order deleted successfully',
      });
    });

    test('should reject invalid ID', async () => {
      const req = {
        params: {
          id: 'invalid-id',
        },
      };

      const res = createResponse();

      const deleteSpy = jest.spyOn(SeedOrder, 'findByIdAndDelete');

      await deleteSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid seed order ID',
      });

      expect(deleteSpy).not.toHaveBeenCalled();
    });

    test('should return 404 when order does not exist', async () => {
      const req = {
        params: {
          id: validId,
        },
      };

      const res = createResponse();

      jest.spyOn(SeedOrder, 'findByIdAndDelete').mockResolvedValue(null);

      await deleteSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Seed order not found',
      });
    });

    test('should return 500 when delete fails', async () => {
      const req = {
        params: {
          id: validId,
        },
      };

      const res = createResponse();

      jest.spyOn(SeedOrder, 'findByIdAndDelete').mockRejectedValue(new Error('Database error'));

      await deleteSeedOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  describe('updateSeedOrderStatus', () => {
    test('should update status successfully', async () => {
      const req = {
        params: {
          id: validId,
        },
        body: {
          status: 'received',
        },
      };

      const res = createResponse();

      const order = {
        _id: validId,
        status: 'received',
      };

      jest.spyOn(SeedOrder, 'findByIdAndUpdate').mockResolvedValue(order);

      await updateSeedOrderStatus(req, res);

      expect(SeedOrder.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        {
          status: 'received',
        },
        {
          new: true,
          runValidators: true,
        },
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(order);
    });

    test.each([
      ['invalid ID', 'invalid-id', 'received'],
      ['invalid status', validId, 'invalid'],
    ])('should reject %s', async (_description, id, status) => {
      const req = {
        params: {
          id,
        },
        body: {
          status,
        },
      };

      const res = createResponse();

      const updateSpy = jest.spyOn(SeedOrder, 'findByIdAndUpdate');

      await updateSeedOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should return 404 when order is not found', async () => {
      const req = {
        params: {
          id: validId,
        },
        body: {
          status: 'received',
        },
      };

      const res = createResponse();

      jest.spyOn(SeedOrder, 'findByIdAndUpdate').mockResolvedValue(null);

      await updateSeedOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Seed order not found',
      });
    });

    test('should return 500 when status update fails', async () => {
      const req = {
        params: {
          id: validId,
        },
        body: {
          status: 'received',
        },
      };

      const res = createResponse();

      jest.spyOn(SeedOrder, 'findByIdAndUpdate').mockRejectedValue(new Error('Database error'));

      await updateSeedOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });
});
