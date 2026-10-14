const express = require('express');
const request = require('supertest');

const mockController = {
  getOrders: jest.fn((req, res) => res.status(200).json({ ok: true })),
  createOrder: jest.fn((req, res) => res.status(201).json({ ok: true })),
  getOrderById: jest.fn((req, res) => res.status(200).json({ ok: true })),
  updateOrder: jest.fn((req, res) => res.status(200).json({ ok: true })),
  deleteOrder: jest.fn((req, res) => res.status(200).json({ ok: true })),
};

jest.mock('../../controllers/kitchenInventory/kitchenOrderController', () =>
  jest.fn(() => mockController),
);

const kitchenOrderRouter = require('./kitchenOrderRouter');

const BASE = '/api/kitchenandinventory';
const ORDER_ID = '507f1f77bcf86cd799439011';

// Stands in for the global auth middleware, which sets req.user from the JWT.
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const role = req.header('x-test-role');
    if (role) {
      req.user = { role, requestorId: ORDER_ID };
    }
    next();
  });
  app.use(BASE, kitchenOrderRouter());
  app.get(`${BASE}/unrelated`, (req, res) => res.status(200).json({ ok: true }));
  return app;
}

const ENDPOINTS = [
  { method: 'get', path: '/orders', handler: 'getOrders', status: 200 },
  { method: 'post', path: '/orders', handler: 'createOrder', status: 201 },
  { method: 'get', path: `/orders/${ORDER_ID}`, handler: 'getOrderById', status: 200 },
  { method: 'put', path: `/orders/${ORDER_ID}`, handler: 'updateOrder', status: 200 },
  { method: 'delete', path: `/orders/${ORDER_ID}`, handler: 'deleteOrder', status: 200 },
];

describe('kitchenOrderRouter', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe.each(['Owner', 'Administrator'])('as %s', (role) => {
    test.each(ENDPOINTS)(
      '$method $path routes to $handler',
      async ({ method, path, handler, status }) => {
        const res = await request(app)[method](`${BASE}${path}`).set('x-test-role', role).send({});

        expect(res.status).toBe(status);
        expect(mockController[handler]).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe.each(['Volunteer', 'Manager', 'Mentor', 'Core Team'])('as %s', (role) => {
    test.each(ENDPOINTS)('$method $path returns 403', async ({ method, path, handler }) => {
      const res = await request(app)[method](`${BASE}${path}`).set('x-test-role', role).send({});

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'You are not authorized to access this resource' });
      expect(mockController[handler]).not.toHaveBeenCalled();
    });
  });

  test('returns 403 when there is no requestor role', async () => {
    const res = await request(app).get(`${BASE}/orders`);

    expect(res.status).toBe(403);
    expect(mockController.getOrders).not.toHaveBeenCalled();
  });

  test('passes query filters through to getOrders', async () => {
    await request(app)
      .get(`${BASE}/orders?supplierId=${ORDER_ID}&status=Delivered`)
      .set('x-test-role', 'Owner');

    const req = mockController.getOrders.mock.calls[0][0];
    expect(req.query).toEqual({ supplierId: ORDER_ID, status: 'Delivered' });
  });

  test('passes orderId as a route param', async () => {
    await request(app).get(`${BASE}/orders/${ORDER_ID}`).set('x-test-role', 'Owner');

    const req = mockController.getOrderById.mock.calls[0][0];
    expect(req.params.orderId).toBe(ORDER_ID);
  });

  test('POST /orders/:id is not a route (supplierId goes in the body)', async () => {
    const res = await request(app)
      .post(`${BASE}/orders/${ORDER_ID}`)
      .set('x-test-role', 'Owner')
      .send({});

    expect(res.status).toBe(404);
    expect(mockController.createOrder).not.toHaveBeenCalled();
  });

  test('does not block other routes mounted on the same base path', async () => {
    const res = await request(app).get(`${BASE}/unrelated`).set('x-test-role', 'Volunteer');

    expect(res.status).toBe(200);
  });
});
