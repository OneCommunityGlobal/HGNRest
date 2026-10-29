const express = require('express');
const request = require('supertest');

const mockController = {
  getSuppliers: jest.fn((req, res) => res.status(200).json({ ok: true })),
  createSupplier: jest.fn((req, res) => res.status(201).json({ ok: true })),
  getSupplierById: jest.fn((req, res) => res.status(200).json({ ok: true })),
  updateSupplier: jest.fn((req, res) => res.status(200).json({ ok: true })),
  deleteSupplier: jest.fn((req, res) => res.status(200).json({ ok: true })),
};

jest.mock('../../controllers/kitchenInventory/kitchenSupplierController', () =>
  jest.fn(() => mockController),
);

const kitchenSupplierRouter = require('./kitchenSupplierRouter');

const BASE = '/api/kitchenandinventory';
const SUPPLIER_ID = '507f1f77bcf86cd799439011';

// Stands in for the global auth middleware, which sets req.user from the JWT.
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const role = req.header('x-test-role');
    if (role) {
      req.user = { role, requestorId: SUPPLIER_ID };
    }
    next();
  });
  app.use(BASE, kitchenSupplierRouter());
  app.get(`${BASE}/unrelated`, (req, res) => res.status(200).json({ ok: true }));
  return app;
}

const ENDPOINTS = [
  { method: 'get', path: '/suppliers', handler: 'getSuppliers', status: 200 },
  { method: 'post', path: '/suppliers', handler: 'createSupplier', status: 201 },
  { method: 'get', path: `/suppliers/${SUPPLIER_ID}`, handler: 'getSupplierById', status: 200 },
  { method: 'put', path: `/suppliers/${SUPPLIER_ID}`, handler: 'updateSupplier', status: 200 },
  { method: 'delete', path: `/suppliers/${SUPPLIER_ID}`, handler: 'deleteSupplier', status: 200 },
];

describe('kitchenSupplierRouter', () => {
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
    const res = await request(app).get(`${BASE}/suppliers`);

    expect(res.status).toBe(403);
    expect(mockController.getSuppliers).not.toHaveBeenCalled();
  });

  test('role check is case-sensitive', async () => {
    const res = await request(app).get(`${BASE}/suppliers`).set('x-test-role', 'owner');

    expect(res.status).toBe(403);
  });

  test('falls back to req.body.requestor when req.user is not set', async () => {
    const fallbackApp = express();
    fallbackApp.use(express.json());
    fallbackApp.use((req, res, next) => {
      req.body.requestor = { role: 'Owner' };
      next();
    });
    fallbackApp.use(BASE, kitchenSupplierRouter());

    const res = await request(fallbackApp).post(`${BASE}/suppliers`).send({ name: 'Acme' });

    expect(res.status).toBe(201);
    expect(mockController.createSupplier).toHaveBeenCalled();
  });

  test('does not block other routes mounted on the same base path', async () => {
    const res = await request(app).get(`${BASE}/unrelated`).set('x-test-role', 'Volunteer');

    expect(res.status).toBe(200);
  });

  test('returns 404 for unsupported methods', async () => {
    const res = await request(app)
      .patch(`${BASE}/suppliers/${SUPPLIER_ID}`)
      .set('x-test-role', 'Owner');

    expect(res.status).toBe(404);
  });
});
