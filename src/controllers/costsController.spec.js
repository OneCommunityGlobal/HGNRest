const mockCache = {
  hasCache: jest.fn(),
  getCache: jest.fn(),
  setCache: jest.fn(),
  removeCache: jest.fn(),
  clearByPrefix: jest.fn(),
};

jest.mock('../models/costs', () => {
  const mock = jest.fn();
  mock.aggregate = jest.fn();
  mock.findById = jest.fn();
  mock.deleteOne = jest.fn();
  mock.find = jest.fn();
  mock.countDocuments = jest.fn();
  mock.COST_CATEGORIES = [
    'Total Cost of Labor',
    'Total Cost of Materials',
    'Total Cost of Equipment',
  ];
  return mock;
});
jest.mock('../models/bmdashboard/buildingProject', () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../utilities/nodeCache', () => jest.fn(() => mockCache));
jest.mock('../startup/logger', () => ({
  logException: jest.fn(),
}));
jest.mock('../services/bmdashboard/costAggregationService', () => ({
  runCostAggregation: jest.fn(),
}));

const Cost = require('../models/costs');
const BuildingProject = require('../models/bmdashboard/buildingProject');
const logger = require('../startup/logger');
const { runCostAggregation } = require('../services/bmdashboard/costAggregationService');
const costsController = require('./costsController');

const cache = mockCache;
const VALID_OID = '507f1f77bcf86cd799439011';
const VALID_OID_2 = '507f1f77bcf86cd799439012';
const INVALID_OID = 'not-a-valid-id';

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

describe('costsController', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = costsController();
  });

  // ========================
  // getCostBreakdown
  // ========================
  describe('getCostBreakdown', () => {
    test('A.1 — returns 400 for invalid project ID format', async () => {
      const req = makeReq({ query: { projectId: INVALID_OID } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid project ID format' });
    });

    test('A.2 — returns 400 when project not found', async () => {
      BuildingProject.findById = jest
        .fn()
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const req = makeReq({ query: { projectId: VALID_OID } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    test('A.3 — returns 400 for invalid startDate', async () => {
      const req = makeReq({ query: { startDate: 'not-a-date' } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid startDate' });
    });

    test('A.4 — returns 400 for invalid endDate', async () => {
      const req = makeReq({ query: { endDate: 'not-a-date' } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid endDate' });
    });

    test('A.5 — returns 400 when startDate > endDate', async () => {
      const req = makeReq({
        query: { startDate: '2025-12-01', endDate: '2025-01-01' },
      });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid date range: startDate must be before endDate',
      });
    });

    test('A.6 — returns 200 with cached data on cache hit', async () => {
      const cachedData = { project: 'All Projects', totalCost: 100, breakdown: [] };
      cache.hasCache.mockReturnValue(true);
      cache.getCache.mockReturnValue(cachedData);
      const req = makeReq({ query: {} });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(cachedData);
    });

    test('A.7 — returns 200 with "All Projects" when no projectId, no detail', async () => {
      cache.hasCache.mockReturnValue(false);
      Cost.aggregate = jest.fn().mockResolvedValue([
        { category: 'Total Cost of Labor', amount: 500 },
        { category: 'Total Cost of Materials', amount: 300 },
      ]);
      const req = makeReq({ query: {} });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.project).toBe('All Projects');
      expect(response.totalCost).toBe(800);
      expect(response.breakdown).toHaveLength(2);
      expect(cache.setCache).toHaveBeenCalled();
    });

    test('A.8 — returns 200 with project name when projectId provided', async () => {
      cache.hasCache.mockReturnValue(false);
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Project Alpha' }),
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ name: 'Project Alpha' }),
        }),
      });
      Cost.aggregate = jest.fn().mockResolvedValue([]);
      const req = makeReq({ query: { projectId: VALID_OID } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.project).toBe('Project Alpha');
    });

    test('A.9 — returns 200 with projectBreakdown when categoryDetail=true', async () => {
      cache.hasCache.mockReturnValue(false);
      Cost.aggregate = jest.fn().mockResolvedValue([
        {
          _id: { category: 'Total Cost of Labor', projectId: VALID_OID },
          amount: 500,
          projectName: 'Project A',
        },
      ]);
      const req = makeReq({ query: { categoryDetail: 'true' } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      const laborEntry = response.breakdown.find((b) => b.category === 'Total Cost of Labor');
      expect(laborEntry).toBeDefined();
      expect(laborEntry.projectBreakdown).toBeDefined();
      expect(laborEntry.projectBreakdown.length).toBeGreaterThanOrEqual(1);
    });

    test('A.10 — returns 500 when aggregation throws', async () => {
      cache.hasCache.mockReturnValue(false);
      Cost.aggregate = jest.fn().mockRejectedValue(new Error('DB error'));
      const req = makeReq({ query: {} });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch cost breakdown' });
      expect(logger.logException).toHaveBeenCalled();
    });

    test('A.extra — validates startDate only (no endDate) passes', async () => {
      cache.hasCache.mockReturnValue(false);
      Cost.aggregate = jest.fn().mockResolvedValue([]);
      const req = makeReq({ query: { startDate: '2025-01-01' } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('A.extra — validates endDate only (no startDate) passes', async () => {
      cache.hasCache.mockReturnValue(false);
      Cost.aggregate = jest.fn().mockResolvedValue([]);
      const req = makeReq({ query: { endDate: '2025-12-31' } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('A.extra — categoryDetail false runs simple aggregation', async () => {
      cache.hasCache.mockReturnValue(false);
      Cost.aggregate = jest
        .fn()
        .mockResolvedValue([{ category: 'Total Cost of Labor', amount: 100 }]);
      const req = makeReq({ query: { categoryDetail: 'false' } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.breakdown[0]).not.toHaveProperty('projectBreakdown');
    });

    test('A.extra — detailed aggregation with zero amount category', async () => {
      cache.hasCache.mockReturnValue(false);
      Cost.aggregate = jest.fn().mockResolvedValue([]);
      const req = makeReq({ query: { categoryDetail: 'true' } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      response.breakdown.forEach((entry) => {
        expect(entry.projectBreakdown).toEqual([]);
      });
    });

    test('A.extra — detailed aggregation row with unknown category is skipped', async () => {
      cache.hasCache.mockReturnValue(false);
      Cost.aggregate = jest.fn().mockResolvedValue([
        {
          _id: { category: 'Unknown Category', projectId: VALID_OID },
          amount: 100,
          projectName: 'X',
        },
      ]);
      const req = makeReq({ query: { categoryDetail: 'true' } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.totalCost).toBe(0);
    });

    test('A.extra — project findById returns null uses All Projects for label', async () => {
      cache.hasCache.mockReturnValue(false);
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Exists' }),
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });
      Cost.aggregate = jest.fn().mockResolvedValue([]);
      const req = makeReq({ query: { projectId: VALID_OID } });
      const res = makeRes();

      await controller.getCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.project).toBe('All Projects');
    });
  });

  // ========================
  // addCostEntry
  // ========================
  describe('addCostEntry', () => {
    test('A.11 — returns 403 for non-admin', async () => {
      const req = makeReq({
        body: { requestor: { role: 'Volunteer' } },
      });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Admin access required' });
    });

    test('A.12 — returns 400 when category/amount/projectId missing', async () => {
      const req = makeReq({ body: {} });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'category, amount, and projectId are all required',
      });
    });

    test('A.13 — returns 400 for invalid category', async () => {
      const req = makeReq({
        body: { category: 'Bad Category', amount: 100, projectId: VALID_OID },
      });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toMatch(/Invalid category/);
    });

    test('A.14 — returns 400 for invalid projectId format', async () => {
      const req = makeReq({
        body: { category: 'Total Cost of Labor', amount: 100, projectId: INVALID_OID },
      });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid project ID format' });
    });

    test('A.15a — returns 400 when amount is negative', async () => {
      const req = makeReq({
        body: { category: 'Total Cost of Labor', amount: -5, projectId: VALID_OID },
      });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Amount must be a non-negative number' });
    });

    test('A.15b — returns 400 when amount is NaN', async () => {
      const req = makeReq({
        body: { category: 'Total Cost of Labor', amount: 'abc', projectId: VALID_OID },
      });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Amount must be a non-negative number' });
    });

    test('A.16 — returns 400 when project not found', async () => {
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      const req = makeReq({
        body: { category: 'Total Cost of Labor', amount: 100, projectId: VALID_OID },
      });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    test('A.17 — returns 201 on success and invalidates cache', async () => {
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue({ _id: VALID_OID, name: 'Proj', projectType: 'commercial' }),
      });
      const savedDoc = {
        _id: VALID_OID_2,
        category: 'Total Cost of Labor',
        amount: 100,
        projectId: VALID_OID,
        projectName: 'Proj',
        projectType: 'commercial',
        source: 'manual',
        save: jest.fn().mockResolvedValue(true),
      };
      Cost.mockImplementation(() => savedDoc);
      const req = makeReq({
        body: {
          category: 'Total Cost of Labor',
          amount: 100,
          projectId: VALID_OID,
          costDate: '2025-06-01',
        },
      });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(savedDoc.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(cache.clearByPrefix).toHaveBeenCalledWith('cost_breakdown:');
      expect(cache.clearByPrefix).toHaveBeenCalledWith('costs_project:');
    });

    test('A.17b — success with no costDate uses default (today)', async () => {
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Proj' }),
      });
      const savedDoc = { save: jest.fn().mockResolvedValue(true) };
      Cost.mockImplementation(() => savedDoc);
      const req = makeReq({
        body: { category: 'Total Cost of Materials', amount: 50, projectId: VALID_OID },
      });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('A.18 — returns 500 when save throws', async () => {
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Proj' }),
      });
      const savedDoc = { save: jest.fn().mockRejectedValue(new Error('save failed')) };
      Cost.mockImplementation(() => savedDoc);
      const req = makeReq({
        body: { category: 'Total Cost of Labor', amount: 100, projectId: VALID_OID },
      });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to add cost entry' });
      expect(logger.logException).toHaveBeenCalled();
    });

    test('A.extra — Owner role is also admin', async () => {
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Proj' }),
      });
      const savedDoc = { save: jest.fn().mockResolvedValue(true) };
      Cost.mockImplementation(() => savedDoc);
      const req = makeReq({
        body: {
          requestor: { role: 'Owner' },
          category: 'Total Cost of Labor',
          amount: 100,
          projectId: VALID_OID,
        },
      });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('A.extra — amount 0 is valid', async () => {
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Proj' }),
      });
      const savedDoc = { save: jest.fn().mockResolvedValue(true) };
      Cost.mockImplementation(() => savedDoc);
      const req = makeReq({
        body: { category: 'Total Cost of Labor', amount: 0, projectId: VALID_OID },
      });
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('A.extra — no requestor returns 403', async () => {
      const req = { body: {}, query: {}, params: {} };
      const res = makeRes();

      await controller.addCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ========================
  // updateCostEntry
  // ========================
  describe('updateCostEntry', () => {
    test('A.19 — returns 403 for non-admin', async () => {
      const req = makeReq({
        body: { requestor: { role: 'Volunteer' } },
        params: { costId: VALID_OID },
      });
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('A.20 — returns 400 for invalid costId', async () => {
      const req = makeReq({ params: { costId: INVALID_OID } });
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid cost ID format' });
    });

    test('A.21a — returns 400 for invalid category', async () => {
      const req = makeReq({
        params: { costId: VALID_OID },
        body: { category: 'Bad Cat' },
      });
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toMatch(/Invalid category/);
    });

    test('A.21b — returns 400 for negative amount', async () => {
      const req = makeReq({
        params: { costId: VALID_OID },
        body: { amount: -10 },
      });
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Amount must be a non-negative number' });
    });

    test('A.22 — returns 404 when cost not found', async () => {
      Cost.findById = jest.fn().mockResolvedValue(null);
      const req = makeReq({ params: { costId: VALID_OID } });
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cost entry not found' });
    });

    test('A.23 — returns 200 on success and invalidates cache', async () => {
      const costDoc = {
        _id: VALID_OID,
        category: 'Total Cost of Labor',
        amount: 100,
        save: jest.fn().mockResolvedValue(true),
      };
      Cost.findById = jest.fn().mockResolvedValue(costDoc);
      const req = makeReq({
        params: { costId: VALID_OID },
        body: { category: 'Total Cost of Materials', amount: 200 },
      });
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(costDoc.category).toBe('Total Cost of Materials');
      expect(costDoc.amount).toBe(200);
      expect(costDoc.source).toBe('correction');
      expect(costDoc.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(cache.clearByPrefix).toHaveBeenCalledWith('cost_breakdown:');
    });

    test('A.23b — update with only category (no amount)', async () => {
      const costDoc = {
        _id: VALID_OID,
        category: 'Total Cost of Labor',
        amount: 100,
        save: jest.fn().mockResolvedValue(true),
      };
      Cost.findById = jest.fn().mockResolvedValue(costDoc);
      const req = makeReq({
        params: { costId: VALID_OID },
        body: { category: 'Total Cost of Equipment' },
      });
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(costDoc.category).toBe('Total Cost of Equipment');
      expect(costDoc.amount).toBe(100);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('A.23c — update with amount 0 is valid', async () => {
      const costDoc = {
        _id: VALID_OID,
        amount: 100,
        save: jest.fn().mockResolvedValue(true),
      };
      Cost.findById = jest.fn().mockResolvedValue(costDoc);
      const req = makeReq({
        params: { costId: VALID_OID },
        body: { amount: 0 },
      });
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(costDoc.amount).toBe(0);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('A.24 — returns 500 when save throws', async () => {
      const costDoc = {
        _id: VALID_OID,
        save: jest.fn().mockRejectedValue(new Error('save error')),
      };
      Cost.findById = jest.fn().mockResolvedValue(costDoc);
      const req = makeReq({
        params: { costId: VALID_OID },
        body: { amount: 50 },
      });
      const res = makeRes();

      await controller.updateCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update cost entry' });
      expect(logger.logException).toHaveBeenCalled();
    });
  });

  // ========================
  // deleteCostEntry
  // ========================
  describe('deleteCostEntry', () => {
    test('A.25 — returns 403 for non-admin', async () => {
      const req = makeReq({
        body: { requestor: { role: 'Volunteer' } },
        params: { costId: VALID_OID },
      });
      const res = makeRes();

      await controller.deleteCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('A.26 — returns 400 for invalid costId', async () => {
      const req = makeReq({ params: { costId: INVALID_OID } });
      const res = makeRes();

      await controller.deleteCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid cost ID format' });
    });

    test('A.27 — returns 404 when cost not found', async () => {
      Cost.findById = jest.fn().mockResolvedValue(null);
      const req = makeReq({ params: { costId: VALID_OID } });
      const res = makeRes();

      await controller.deleteCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cost entry not found' });
    });

    test('A.28 — returns 200 on success and invalidates cache', async () => {
      Cost.findById = jest.fn().mockResolvedValue({ _id: VALID_OID });
      Cost.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
      const req = makeReq({ params: { costId: VALID_OID } });
      const res = makeRes();

      await controller.deleteCostEntry(req, res);

      expect(Cost.deleteOne).toHaveBeenCalledWith({ _id: VALID_OID });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Cost entry deleted successfully' });
      expect(cache.clearByPrefix).toHaveBeenCalledWith('cost_breakdown:');
      expect(cache.clearByPrefix).toHaveBeenCalledWith('costs_project:');
    });

    test('A.29 — returns 500 when findById throws', async () => {
      Cost.findById = jest.fn().mockRejectedValue(new Error('db error'));
      const req = makeReq({ params: { costId: VALID_OID } });
      const res = makeRes();

      await controller.deleteCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to delete cost entry' });
      expect(logger.logException).toHaveBeenCalled();
    });

    test('A.29b — returns 500 when deleteOne throws', async () => {
      Cost.findById = jest.fn().mockResolvedValue({ _id: VALID_OID });
      Cost.deleteOne = jest.fn().mockRejectedValue(new Error('delete error'));
      const req = makeReq({ params: { costId: VALID_OID } });
      const res = makeRes();

      await controller.deleteCostEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to delete cost entry' });
    });
  });

  // ========================
  // getCostsByProject
  // ========================
  describe('getCostsByProject', () => {
    test('A.30 — returns 400 for invalid projectId', async () => {
      const req = makeReq({ params: { projectId: INVALID_OID } });
      const res = makeRes();

      await controller.getCostsByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid project ID format' });
    });

    test('A.31 — returns 400 when project not found', async () => {
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      const req = makeReq({ params: { projectId: VALID_OID } });
      const res = makeRes();

      await controller.getCostsByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    test('A.32 — returns 200 with cached response on cache hit', async () => {
      cache.hasCache.mockReturnValue(true);
      const cachedData = { costs: [], pagination: {} };
      cache.getCache.mockReturnValue(cachedData);
      const req = makeReq({ params: { projectId: VALID_OID } });
      const res = makeRes();

      await controller.getCostsByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(cachedData);
    });

    test('A.33 — returns 200 with costs and pagination', async () => {
      cache.hasCache.mockReturnValue(false);
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Test' }),
      });
      const mockCosts = [{ _id: '1', amount: 100 }];
      Cost.countDocuments = jest.fn().mockResolvedValue(1);
      Cost.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockCosts),
            }),
          }),
        }),
      });
      const req = makeReq({ params: { projectId: VALID_OID }, query: { page: '1', limit: '10' } });
      const res = makeRes();

      await controller.getCostsByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.costs).toEqual(mockCosts);
      expect(response.pagination).toBeDefined();
      expect(response.pagination.totalCosts).toBe(1);
      expect(response.pagination.currentPage).toBe(1);
      expect(cache.setCache).toHaveBeenCalled();
    });

    test('A.34 — returns 200 with category filter', async () => {
      cache.hasCache.mockReturnValue(false);
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Test' }),
      });
      Cost.countDocuments = jest.fn().mockResolvedValue(0);
      Cost.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      const req = makeReq({
        params: { projectId: VALID_OID },
        query: { category: 'Total Cost of Labor' },
      });
      const res = makeRes();

      await controller.getCostsByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('A.34b — invalid category filter is ignored', async () => {
      cache.hasCache.mockReturnValue(false);
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Test' }),
      });
      Cost.countDocuments = jest.fn().mockResolvedValue(0);
      Cost.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      const req = makeReq({
        params: { projectId: VALID_OID },
        query: { category: 'Not A Real Category' },
      });
      const res = makeRes();

      await controller.getCostsByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('A.35 — returns 500 when find throws', async () => {
      cache.hasCache.mockReturnValue(false);
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Test' }),
      });
      Cost.countDocuments = jest.fn().mockRejectedValue(new Error('count error'));
      const req = makeReq({ params: { projectId: VALID_OID } });
      const res = makeRes();

      await controller.getCostsByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch costs for project' });
      expect(logger.logException).toHaveBeenCalled();
    });

    test('A.extra — default page/limit when not provided', async () => {
      cache.hasCache.mockReturnValue(false);
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Test' }),
      });
      Cost.countDocuments = jest.fn().mockResolvedValue(50);
      Cost.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      const req = makeReq({ params: { projectId: VALID_OID } });
      const res = makeRes();

      await controller.getCostsByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.pagination.currentPage).toBe(1);
      expect(response.pagination.limit).toBe(20);
    });

    test('A.extra — page limit capped at MAX_PAGE_LIMIT (100)', async () => {
      cache.hasCache.mockReturnValue(false);
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Test' }),
      });
      Cost.countDocuments = jest.fn().mockResolvedValue(0);
      Cost.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      const req = makeReq({
        params: { projectId: VALID_OID },
        query: { limit: '999' },
      });
      const res = makeRes();

      await controller.getCostsByProject(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.pagination.limit).toBe(100);
    });
  });

  // ========================
  // refreshCosts
  // ========================
  describe('refreshCosts', () => {
    test('A.36 — returns 403 for non-admin', async () => {
      const req = makeReq({ body: { requestor: { role: 'Volunteer' } } });
      const res = makeRes();

      await controller.refreshCosts(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('A.37 — returns 400 when projectIds not array', async () => {
      const req = makeReq({ body: { projectIds: 'not-array' } });
      const res = makeRes();

      await controller.refreshCosts(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'projectIds must be an array' });
    });

    test('A.38 — returns 400 when invalid id in projectIds', async () => {
      const req = makeReq({ body: { projectIds: [VALID_OID, INVALID_OID] } });
      const res = makeRes();

      await controller.refreshCosts(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toMatch(/Invalid project ID/);
    });

    test('A.39 — returns 200 on success with no projectIds', async () => {
      runCostAggregation.mockResolvedValue({ updated: 5, errors: [] });
      const req = makeReq({ body: {} });
      const res = makeRes();

      await controller.refreshCosts(req, res);

      expect(runCostAggregation).toHaveBeenCalledWith(null);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cost aggregation completed',
        updated: 5,
        errors: [],
      });
      expect(cache.clearByPrefix).toHaveBeenCalledWith('cost_breakdown:');
      expect(cache.clearByPrefix).toHaveBeenCalledWith('costs_project:');
    });

    test('A.40 — returns 200 on success with projectIds', async () => {
      runCostAggregation.mockResolvedValue({ updated: 2, errors: [] });
      const req = makeReq({ body: { projectIds: [VALID_OID, VALID_OID_2] } });
      const res = makeRes();

      await controller.refreshCosts(req, res);

      expect(runCostAggregation).toHaveBeenCalledWith([VALID_OID, VALID_OID_2]);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].updated).toBe(2);
    });

    test('A.41 — returns 500 when runCostAggregation throws', async () => {
      runCostAggregation.mockRejectedValue(new Error('agg error'));
      const req = makeReq({ body: {} });
      const res = makeRes();

      await controller.refreshCosts(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to refresh costs' });
      expect(logger.logException).toHaveBeenCalled();
    });
  });
});
