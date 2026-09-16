const express = require('express');
const request = require('supertest');

const mockController = {
  getCostBreakdown: jest.fn((req, res) => res.status(200).json({ ok: true })),
  refreshCosts: jest.fn((req, res) => res.status(200).json({ ok: true })),
  addCostEntry: jest.fn((req, res) => res.status(201).json({ ok: true })),
  updateCostEntry: jest.fn((req, res) => res.status(200).json({ ok: true })),
  deleteCostEntry: jest.fn((req, res) => res.status(200).json({ ok: true })),
  getCostsByProject: jest.fn((req, res) => res.status(200).json({ ok: true })),
};

jest.mock('../controllers/costsController', () => jest.fn(() => mockController));

const costsRouter = require('./costsRouter');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/costs', costsRouter());
  return app;
}

describe('costsRouter', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('C.1 — GET /api/costs/breakdown routes to getCostBreakdown', async () => {
    const res = await request(app).get('/api/costs/breakdown');

    expect(res.status).toBe(200);
    expect(mockController.getCostBreakdown).toHaveBeenCalled();
  });

  test('C.2 — POST /api/costs/refresh routes to refreshCosts', async () => {
    const res = await request(app).post('/api/costs/refresh').send({});

    expect(res.status).toBe(200);
    expect(mockController.refreshCosts).toHaveBeenCalled();
  });

  test('C.3 — POST /api/costs/ routes to addCostEntry', async () => {
    const res = await request(app).post('/api/costs').send({});

    expect(res.status).toBe(201);
    expect(mockController.addCostEntry).toHaveBeenCalled();
  });

  test('C.4 — PUT /api/costs/:costId routes to updateCostEntry', async () => {
    const res = await request(app).put('/api/costs/507f1f77bcf86cd799439011').send({});

    expect(res.status).toBe(200);
    expect(mockController.updateCostEntry).toHaveBeenCalled();
  });

  test('C.5 — DELETE /api/costs/:costId routes to deleteCostEntry', async () => {
    const res = await request(app).delete('/api/costs/507f1f77bcf86cd799439011');

    expect(res.status).toBe(200);
    expect(mockController.deleteCostEntry).toHaveBeenCalled();
  });

  test('C.6 — GET /api/costs/project/:projectId routes to getCostsByProject', async () => {
    const res = await request(app).get('/api/costs/project/507f1f77bcf86cd799439011');

    expect(res.status).toBe(200);
    expect(mockController.getCostsByProject).toHaveBeenCalled();
  });

  test('C.extra — PUT /:costId passes costId in params', async () => {
    await request(app).put('/api/costs/507f1f77bcf86cd799439011').send({});

    const req = mockController.updateCostEntry.mock.calls[0][0];
    expect(req.params.costId).toBe('507f1f77bcf86cd799439011');
  });

  test('C.extra — GET /project/:projectId passes projectId in params', async () => {
    await request(app).get('/api/costs/project/507f1f77bcf86cd799439011');

    const req = mockController.getCostsByProject.mock.calls[0][0];
    expect(req.params.projectId).toBe('507f1f77bcf86cd799439011');
  });

  test('C.extra — DELETE /:costId passes costId in params', async () => {
    await request(app).delete('/api/costs/507f1f77bcf86cd799439011');

    const req = mockController.deleteCostEntry.mock.calls[0][0];
    expect(req.params.costId).toBe('507f1f77bcf86cd799439011');
  });

  test('C.extra — unknown route returns 404', async () => {
    const res = await request(app).get('/api/costs/unknown/route/here');

    expect(res.status).toBe(404);
  });
});
