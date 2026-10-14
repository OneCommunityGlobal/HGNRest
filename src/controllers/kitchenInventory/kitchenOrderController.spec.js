jest.mock('../../models/kitchenInventory/supplier', () => ({
  findById: jest.fn(),
}));
jest.mock('../../models/kitchenInventory/order', () => {
  const mock = jest.fn();
  mock.schema = {
    path: jest.fn(() => ({
      enumValues: ['Pending', 'Ordered', 'Shipped', 'Delivered', 'Cancelled'],
    })),
  };
  mock.find = jest.fn();
  mock.findById = jest.fn();
  mock.findByIdAndUpdate = jest.fn();
  mock.findByIdAndDelete = jest.fn();
  return mock;
});

const Supplier = require('../../models/kitchenInventory/supplier');
const Order = require('../../models/kitchenInventory/order');
const kitchenOrderController = require('./kitchenOrderController');

const VALID_OID = '507f1f77bcf86cd799439011';
const SUPPLIER_OID = '507f1f77bcf86cd799439012';
const INVALID_OID = 'not-a-valid-id';

const ITEMS = [
  { itemName: 'Tomatoes', quantity: 2, pricePerItem: 1.5 },
  { itemName: 'Onions', quantity: 4, pricePerItem: 0.5 },
];

function makeReq(overrides = {}) {
  return {
    body: {
      requestor: { role: 'Administrator', requestorId: VALID_OID },
      ...overrides.body,
    },
    query: overrides.query || {},
    params: overrides.params || {},
  };
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
}

function mockFindChain(value, { reject = false } = {}) {
  const chain = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: reject ? jest.fn().mockRejectedValue(value) : jest.fn().mockResolvedValue(value),
  };
  Order.find.mockReturnValue(chain);
  return chain;
}

describe('kitchenOrderController', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = kitchenOrderController();
  });

  describe('createOrder', () => {
    test('returns 400 when supplierId is missing', async () => {
      const res = makeRes();
      await controller.createOrder(makeReq({ body: {} }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid Supplier id' });
      expect(Supplier.findById).not.toHaveBeenCalled();
    });

    test('returns 400 when supplierId is invalid', async () => {
      const res = makeRes();
      await controller.createOrder(makeReq({ body: { supplierId: INVALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid Supplier id' });
    });

    test('returns 400 when status is not an allowed value', async () => {
      const res = makeRes();
      await controller.createOrder(
        makeReq({ body: { supplierId: SUPPLIER_OID, status: 'Lost' } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid order status' });
      expect(Supplier.findById).not.toHaveBeenCalled();
    });

    test('returns 400 when the supplier does not exist', async () => {
      Supplier.findById.mockResolvedValue(null);
      const res = makeRes();

      await controller.createOrder(makeReq({ body: { supplierId: SUPPLIER_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Supplier Not Found' });
    });

    test('returns 400 when the supplier is inactive', async () => {
      Supplier.findById.mockResolvedValue({ _id: SUPPLIER_OID, isActive: false });
      const res = makeRes();

      await controller.createOrder(makeReq({ body: { supplierId: SUPPLIER_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Supplier Not Found' });
    });

    test('returns 400 when items is not an array', async () => {
      Supplier.findById.mockResolvedValue({ _id: SUPPLIER_OID, isActive: true });
      const res = makeRes();

      await controller.createOrder(
        makeReq({ body: { supplierId: SUPPLIER_OID, items: 'Tomatoes' } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid items' });
    });

    test.each([
      ['quantity is not a number', { quantity: '2', pricePerItem: 1 }],
      ['pricePerItem is not a number', { quantity: 2, pricePerItem: '1' }],
      ['quantity is negative', { quantity: -1, pricePerItem: 1 }],
      ['pricePerItem is negative', { quantity: 1, pricePerItem: -1 }],
      ['item is null', null],
    ])('returns 400 when an item is invalid (%s)', async (_label, item) => {
      Supplier.findById.mockResolvedValue({ _id: SUPPLIER_OID, isActive: true });
      const res = makeRes();

      await controller.createOrder(
        makeReq({ body: { supplierId: SUPPLIER_OID, items: [item] } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid order item' });
      expect(Order).not.toHaveBeenCalled();
    });

    test('creates the order and returns 201', async () => {
      Supplier.findById.mockResolvedValue({ _id: SUPPLIER_OID, isActive: true });
      const saved = { _id: VALID_OID, status: 'Ordered' };
      const save = jest.fn().mockResolvedValue(saved);
      Order.mockImplementation(() => ({ save }));
      const res = makeRes();

      await controller.createOrder(
        makeReq({
          body: {
            supplierId: SUPPLIER_OID,
            status: 'Ordered',
            orderDate: '2026-09-01',
            expectedDeliveryDate: '2026-09-05',
            items: ITEMS,
          },
        }),
        res,
      );

      const orderData = Order.mock.calls[0][0];
      expect(String(orderData.supplierId)).toBe(SUPPLIER_OID);
      expect(orderData).toEqual(
        expect.objectContaining({
          status: 'Ordered',
          orderDate: '2026-09-01',
          expectedDeliveryDate: '2026-09-05',
          items: ITEMS,
        }),
      );
      expect(orderData).not.toHaveProperty('actualDeliveryDate');
      expect(save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(saved);
    });

    test('creates the order without items when items is not sent', async () => {
      Supplier.findById.mockResolvedValue({ _id: SUPPLIER_OID, isActive: true });
      Order.mockImplementation(() => ({ save: jest.fn().mockResolvedValue({}) }));
      const res = makeRes();

      await controller.createOrder(makeReq({ body: { supplierId: SUPPLIER_OID } }), res);

      expect(Order.mock.calls[0][0]).not.toHaveProperty('items');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('returns 400 when save fails', async () => {
      Supplier.findById.mockResolvedValue({ _id: SUPPLIER_OID, isActive: true });
      Order.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('validation failed')),
      }));
      const res = makeRes();

      await controller.createOrder(makeReq({ body: { supplierId: SUPPLIER_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ err: 'Unable to create order' });
    });
  });

  describe('getOrders', () => {
    test('returns 400 when supplierId filter is invalid', async () => {
      const res = makeRes();
      await controller.getOrders(makeReq({ query: { supplierId: INVALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ message: 'Invalid Supplier Id' });
      expect(Order.find).not.toHaveBeenCalled();
    });

    test('returns 400 when status filter is invalid', async () => {
      const res = makeRes();
      await controller.getOrders(makeReq({ query: { status: 'Lost' } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ message: 'Invalid order status' });
    });

    test('returns all orders sorted by newest first with supplier details', async () => {
      const orders = [{ _id: VALID_OID }];
      const chain = mockFindChain(orders);
      const res = makeRes();

      await controller.getOrders(makeReq(), res);

      expect(Order.find).toHaveBeenCalledWith({});
      expect(chain.populate).toHaveBeenCalledWith({
        path: 'supplierId',
        select: 'name email phone',
      });
      expect(chain.sort).toHaveBeenCalledWith({ orderDate: -1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(orders);
    });

    test('filters by supplierId and status', async () => {
      mockFindChain([]);

      await controller.getOrders(
        makeReq({ query: { supplierId: SUPPLIER_OID, status: 'Delivered' } }),
        makeRes(),
      );

      const query = Order.find.mock.calls[0][0];
      expect(String(query.supplierId)).toBe(SUPPLIER_OID);
      expect(query.status).toBe('Delivered');
    });

    test('returns 500 when the query fails', async () => {
      mockFindChain(new Error('db down'), { reject: true });
      const res = makeRes();

      await controller.getOrders(makeReq(), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ err: 'Internal server error' });
    });
  });

  describe('getOrderById', () => {
    test('returns 400 for an invalid id', async () => {
      const res = makeRes();
      await controller.getOrderById(makeReq({ params: { orderId: INVALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ message: 'Invalid order id' });
      expect(Order.findById).not.toHaveBeenCalled();
    });

    test('returns 404 when the order does not exist', async () => {
      Order.findById.mockResolvedValue(null);
      const res = makeRes();

      await controller.getOrderById(makeReq({ params: { orderId: VALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Order Not Found' });
    });

    test('returns 200 with the order', async () => {
      const order = { _id: VALID_OID, status: 'Pending' };
      Order.findById.mockResolvedValue(order);
      const res = makeRes();

      await controller.getOrderById(makeReq({ params: { orderId: VALID_OID } }), res);

      expect(String(Order.findById.mock.calls[0][0])).toBe(VALID_OID);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(order);
    });

    test('returns 500 when the query fails', async () => {
      Order.findById.mockRejectedValue(new Error('boom'));
      const res = makeRes();

      await controller.getOrderById(makeReq({ params: { orderId: VALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ err: 'Internal server error' });
    });
  });

  describe('updateOrder', () => {
    test('returns 400 for an invalid order id', async () => {
      const res = makeRes();
      await controller.updateOrder(makeReq({ params: { orderId: INVALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ message: 'Invalid order id' });
    });

    test('returns 400 for an invalid supplierId', async () => {
      const res = makeRes();
      await controller.updateOrder(
        makeReq({ params: { orderId: VALID_OID }, body: { supplierId: INVALID_OID } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ message: 'Invalid Supplier id' });
    });

    test('returns 400 for an invalid status', async () => {
      const res = makeRes();
      await controller.updateOrder(
        makeReq({ params: { orderId: VALID_OID }, body: { status: 'Lost' } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ message: 'Invalid order status' });
      expect(Order.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test('returns 400 for invalid items', async () => {
      const res = makeRes();
      await controller.updateOrder(
        makeReq({
          params: { orderId: VALID_OID },
          body: { items: [{ quantity: -1, pricePerItem: 1 }] },
        }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid order item' });
      expect(Order.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test('updates the order and recalculates totalAmount from items', async () => {
      const updated = { _id: VALID_OID, status: 'Delivered' };
      Order.findByIdAndUpdate.mockResolvedValue(updated);
      const res = makeRes();

      await controller.updateOrder(
        makeReq({
          params: { orderId: VALID_OID },
          body: {
            supplierId: SUPPLIER_OID,
            status: 'Delivered',
            actualDeliveryDate: '2026-09-06',
            items: ITEMS,
          },
        }),
        res,
      );

      const [id, update, options] = Order.findByIdAndUpdate.mock.calls[0];
      expect(String(id)).toBe(VALID_OID);
      expect(String(update.supplierId)).toBe(SUPPLIER_OID);
      expect(update).toEqual(
        expect.objectContaining({
          status: 'Delivered',
          actualDeliveryDate: '2026-09-06',
          items: ITEMS,
          totalAmount: 5,
        }),
      );
      expect(options).toEqual({ new: true, runValidators: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(updated);
    });

    test('only updates the fields that were sent', async () => {
      Order.findByIdAndUpdate.mockResolvedValue({ _id: VALID_OID });

      await controller.updateOrder(
        makeReq({ params: { orderId: VALID_OID }, body: { status: 'Shipped' } }),
        makeRes(),
      );

      expect(Order.findByIdAndUpdate.mock.calls[0][1]).toEqual({ status: 'Shipped' });
    });

    test('returns 404 when the order does not exist', async () => {
      Order.findByIdAndUpdate.mockResolvedValue(null);
      const res = makeRes();

      await controller.updateOrder(
        makeReq({ params: { orderId: VALID_OID }, body: { status: 'Shipped' } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Order Not Found' });
    });

    test('returns 400 when the update fails', async () => {
      Order.findByIdAndUpdate.mockRejectedValue(new Error('validation failed'));
      const res = makeRes();

      await controller.updateOrder(
        makeReq({ params: { orderId: VALID_OID }, body: { status: 'Shipped' } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ err: 'Unable to update order' });
    });
  });

  describe('deleteOrder', () => {
    test('returns 400 for an invalid id', async () => {
      const res = makeRes();
      await controller.deleteOrder(makeReq({ params: { orderId: INVALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid Order Id' });
      expect(Order.findByIdAndDelete).not.toHaveBeenCalled();
    });

    test('returns 404 when the order does not exist', async () => {
      Order.findByIdAndDelete.mockResolvedValue(null);
      const res = makeRes();

      await controller.deleteOrder(makeReq({ params: { orderId: VALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Order Not Found' });
    });

    test('deletes the order and returns 200', async () => {
      Order.findByIdAndDelete.mockResolvedValue({ _id: VALID_OID });
      const res = makeRes();

      await controller.deleteOrder(makeReq({ params: { orderId: VALID_OID } }), res);

      expect(String(Order.findByIdAndDelete.mock.calls[0][0])).toBe(VALID_OID);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Deleted' });
    });

    test('returns 500 when the delete fails', async () => {
      Order.findByIdAndDelete.mockRejectedValue(new Error('boom'));
      const res = makeRes();

      await controller.deleteOrder(makeReq({ params: { orderId: VALID_OID } }), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ err: 'Internal server error' });
    });
  });
});
