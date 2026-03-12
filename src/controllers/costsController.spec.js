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

function mockProjectFound(project = { _id: VALID_OID, name: 'Test' }) {
  const leanRes = Promise.resolve(project);
  BuildingProject.findById = jest.fn().mockReturnValue({
    lean: () => leanRes,
    select: jest.fn().mockReturnValue({ lean: () => Promise.resolve(project) }),
  });
}

function mockProjectNotFound() {
  BuildingProject.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
}

function mockCostFindPaginated(costs = [], total = 0) {
  Cost.countDocuments = jest.fn().mockResolvedValue(total);
  Cost.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(costs),
        }),
      }),
    }),
  });
}

function expectStatusAndJson(res, status, json = undefined) {
  expect(res.status).toHaveBeenCalledWith(status);
  if (json !== undefined) {
    expect(res.json).toHaveBeenCalledWith(json);
  }
}

async function callController(method, overrides = {}) {
  const req = makeReq(overrides);
  const res = makeRes();
  await method(req, res);
  return { req, res };
}

async function expectError(method, overrides, status, body) {
  const { res } = await callController(method, overrides);
  expectStatusAndJson(res, status, body);
}

function setupBreakdownNoCache(aggregateResult = []) {
  cache.hasCache.mockReturnValue(false);
  Cost.aggregate = jest.fn().mockResolvedValue(aggregateResult);
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
      await expectError(controller.getCostBreakdown, { query: { projectId: INVALID_OID } }, 400, {
        error: 'Invalid project ID format',
      });
    });

    test('A.2 — returns 400 when project not found', async () => {
      mockProjectNotFound();
      await expectError(controller.getCostBreakdown, { query: { projectId: VALID_OID } }, 400, {
        error: 'Project not found',
      });
    });

    test('A.3 — returns 400 for invalid startDate', async () => {
      await expectError(controller.getCostBreakdown, { query: { startDate: 'not-a-date' } }, 400, {
        error: 'Invalid startDate',
      });
    });

    test('A.4 — returns 400 for invalid endDate', async () => {
      await expectError(controller.getCostBreakdown, { query: { endDate: 'not-a-date' } }, 400, {
        error: 'Invalid endDate',
      });
    });

    test('A.5 — returns 400 when startDate > endDate', async () => {
      await expectError(
        controller.getCostBreakdown,
        { query: { startDate: '2025-12-01', endDate: '2025-01-01' } },
        400,
        { error: 'Invalid date range: startDate must be before endDate' },
      );
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
      setupBreakdownNoCache([
        { category: 'Total Cost of Labor', amount: 500 },
        { category: 'Total Cost of Materials', amount: 300 },
      ]);
      const { res } = await callController(controller.getCostBreakdown, { query: {} });
      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.project).toBe('All Projects');
      expect(response.totalCost).toBe(800);
      expect(response.breakdown).toHaveLength(2);
      expect(cache.setCache).toHaveBeenCalled();
    });

    test('A.8 — returns 200 with project name when projectId provided', async () => {
      setupBreakdownNoCache([]);
      mockProjectFound({ _id: VALID_OID, name: 'Project Alpha' });
      const { res } = await callController(controller.getCostBreakdown, {
        query: { projectId: VALID_OID },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].project).toBe('Project Alpha');
    });

    test('A.9 — returns 200 with projectBreakdown when categoryDetail=true', async () => {
      setupBreakdownNoCache([
        {
          _id: { category: 'Total Cost of Labor', projectId: VALID_OID },
          amount: 500,
          projectName: 'Project A',
        },
      ]);
      const { res } = await callController(controller.getCostBreakdown, {
        query: { categoryDetail: 'true' },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      const laborEntry = response.breakdown.find((b) => b.category === 'Total Cost of Labor');
      expect(laborEntry).toBeDefined();
      expect(laborEntry.projectBreakdown).toBeDefined();
      expect(laborEntry.projectBreakdown.length).toBeGreaterThanOrEqual(1);
    });

    test('A.10 — returns 500 when aggregation throws', async () => {
      setupBreakdownNoCache();
      Cost.aggregate = jest.fn().mockRejectedValue(new Error('DB error'));
      await expectError(controller.getCostBreakdown, { query: {} }, 500, {
        error: 'Failed to fetch cost breakdown',
      });
      expect(logger.logException).toHaveBeenCalled();
    });

    test.each([
      ['startDate only', { startDate: '2025-01-01' }],
      ['endDate only', { endDate: '2025-12-31' }],
    ])('A.extra — validates %s (no other date) passes', async (_, query) => {
      setupBreakdownNoCache([]);
      const { res } = await callController(controller.getCostBreakdown, { query });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('A.extra — categoryDetail false runs simple aggregation', async () => {
      setupBreakdownNoCache([{ category: 'Total Cost of Labor', amount: 100 }]);
      const { res } = await callController(controller.getCostBreakdown, {
        query: { categoryDetail: 'false' },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.breakdown[0]).not.toHaveProperty('projectBreakdown');
    });

    test('A.extra — detailed aggregation with zero amount category', async () => {
      setupBreakdownNoCache([]);
      const { res } = await callController(controller.getCostBreakdown, {
        query: { categoryDetail: 'true' },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      response.breakdown.forEach((entry) => {
        expect(entry.projectBreakdown).toEqual([]);
      });
    });

    test('A.extra — detailed aggregation row with unknown category is skipped', async () => {
      setupBreakdownNoCache([
        {
          _id: { category: 'Unknown Category', projectId: VALID_OID },
          amount: 100,
          projectName: 'X',
        },
      ]);
      const { res } = await callController(controller.getCostBreakdown, {
        query: { categoryDetail: 'true' },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].totalCost).toBe(0);
    });

    test('A.extra — project findById returns null uses All Projects for label', async () => {
      setupBreakdownNoCache([]);
      BuildingProject.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: VALID_OID, name: 'Exists' }),
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      });
      const { res } = await callController(controller.getCostBreakdown, {
        query: { projectId: VALID_OID },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].project).toBe('All Projects');
    });
  });

  // ========================
  // addCostEntry
  // ========================
  describe('addCostEntry', () => {
    test('A.11 — returns 403 for non-admin', async () => {
      await expectError(
        controller.addCostEntry,
        { body: { requestor: { role: 'Volunteer' } } },
        403,
        { error: 'Unauthorized: Admin access required' },
      );
    });

    test('A.12 — returns 400 when category/amount/projectId missing', async () => {
      await expectError(controller.addCostEntry, { body: {} }, 400, {
        error: 'category, amount, and projectId are all required',
      });
    });

    test('A.13 — returns 400 for invalid category', async () => {
      const { res } = await callController(controller.addCostEntry, {
        body: { category: 'Bad Category', amount: 100, projectId: VALID_OID },
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toMatch(/Invalid category/);
    });

    test('A.14 — returns 400 for invalid projectId format', async () => {
      await expectError(
        controller.addCostEntry,
        {
          body: { category: 'Total Cost of Labor', amount: 100, projectId: INVALID_OID },
        },
        400,
        { error: 'Invalid project ID format' },
      );
    });

    test.each([
      ['negative amount', -5],
      ['NaN amount', 'abc'],
    ])('A.15 — returns 400 when amount is %s', async (_, amount) => {
      await expectError(
        controller.addCostEntry,
        {
          body: { category: 'Total Cost of Labor', amount, projectId: VALID_OID },
        },
        400,
        { error: 'Amount must be a non-negative number' },
      );
    });

    test('A.16 — returns 400 when project not found', async () => {
      mockProjectNotFound();
      await expectError(
        controller.addCostEntry,
        {
          body: { category: 'Total Cost of Labor', amount: 100, projectId: VALID_OID },
        },
        400,
        { error: 'Project not found' },
      );
    });

    test('A.17 — returns 201 on success and invalidates cache', async () => {
      mockProjectFound({ _id: VALID_OID, name: 'Proj', projectType: 'commercial' });
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
      const { res } = await callController(controller.addCostEntry, {
        body: {
          category: 'Total Cost of Labor',
          amount: 100,
          projectId: VALID_OID,
          costDate: '2025-06-01',
        },
      });
      expect(savedDoc.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(cache.clearByPrefix).toHaveBeenCalledWith('cost_breakdown:');
      expect(cache.clearByPrefix).toHaveBeenCalledWith('costs_project:');
    });

    test('A.17b — success with no costDate uses default (today)', async () => {
      mockProjectFound({ _id: VALID_OID, name: 'Proj' });
      Cost.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(true) }));
      const { res } = await callController(controller.addCostEntry, {
        body: { category: 'Total Cost of Materials', amount: 50, projectId: VALID_OID },
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('A.18 — returns 500 when save throws', async () => {
      mockProjectFound({ _id: VALID_OID, name: 'Proj' });
      Cost.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('save failed')),
      }));
      await expectError(
        controller.addCostEntry,
        {
          body: { category: 'Total Cost of Labor', amount: 100, projectId: VALID_OID },
        },
        500,
        { error: 'Failed to add cost entry' },
      );
      expect(logger.logException).toHaveBeenCalled();
    });

    test('A.extra — Owner role is also admin', async () => {
      mockProjectFound({ _id: VALID_OID, name: 'Proj' });
      Cost.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(true) }));
      const { res } = await callController(controller.addCostEntry, {
        body: {
          requestor: { role: 'Owner' },
          category: 'Total Cost of Labor',
          amount: 100,
          projectId: VALID_OID,
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('A.extra — amount 0 is valid', async () => {
      mockProjectFound({ _id: VALID_OID, name: 'Proj' });
      Cost.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(true) }));
      const { res } = await callController(controller.addCostEntry, {
        body: { category: 'Total Cost of Labor', amount: 0, projectId: VALID_OID },
      });
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
      const { res } = await callController(controller.updateCostEntry, {
        body: { requestor: { role: 'Volunteer' } },
        params: { costId: VALID_OID },
      });
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('A.20 — returns 400 for invalid costId', async () => {
      await expectError(controller.updateCostEntry, { params: { costId: INVALID_OID } }, 400, {
        error: 'Invalid cost ID format',
      });
    });

    test('A.21a — returns 400 for invalid category', async () => {
      const { res } = await callController(controller.updateCostEntry, {
        params: { costId: VALID_OID },
        body: { category: 'Bad Cat' },
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toMatch(/Invalid category/);
    });

    test('A.21b — returns 400 for negative amount', async () => {
      await expectError(
        controller.updateCostEntry,
        { params: { costId: VALID_OID }, body: { amount: -10 } },
        400,
        { error: 'Amount must be a non-negative number' },
      );
    });

    test('A.22 — returns 404 when cost not found', async () => {
      Cost.findById = jest.fn().mockResolvedValue(null);
      await expectError(controller.updateCostEntry, { params: { costId: VALID_OID } }, 404, {
        error: 'Cost entry not found',
      });
    });

    test('A.23 — returns 200 on success and invalidates cache', async () => {
      const costDoc = {
        _id: VALID_OID,
        category: 'Total Cost of Labor',
        amount: 100,
        save: jest.fn().mockResolvedValue(true),
      };
      Cost.findById = jest.fn().mockResolvedValue(costDoc);
      const { res } = await callController(controller.updateCostEntry, {
        params: { costId: VALID_OID },
        body: { category: 'Total Cost of Materials', amount: 200 },
      });
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
      const { res } = await callController(controller.updateCostEntry, {
        params: { costId: VALID_OID },
        body: { category: 'Total Cost of Equipment' },
      });
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
      const { res } = await callController(controller.updateCostEntry, {
        params: { costId: VALID_OID },
        body: { amount: 0 },
      });
      expect(costDoc.amount).toBe(0);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('A.24 — returns 500 when save throws', async () => {
      Cost.findById = jest.fn().mockResolvedValue({
        _id: VALID_OID,
        save: jest.fn().mockRejectedValue(new Error('save error')),
      });
      await expectError(
        controller.updateCostEntry,
        { params: { costId: VALID_OID }, body: { amount: 50 } },
        500,
        { error: 'Failed to update cost entry' },
      );
      expect(logger.logException).toHaveBeenCalled();
    });
  });

  // ========================
  // deleteCostEntry
  // ========================
  describe('deleteCostEntry', () => {
    test('A.25 — returns 403 for non-admin', async () => {
      const { res } = await callController(controller.deleteCostEntry, {
        body: { requestor: { role: 'Volunteer' } },
        params: { costId: VALID_OID },
      });
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('A.26 — returns 400 for invalid costId', async () => {
      await expectError(controller.deleteCostEntry, { params: { costId: INVALID_OID } }, 400, {
        error: 'Invalid cost ID format',
      });
    });

    test('A.27 — returns 404 when cost not found', async () => {
      Cost.findById = jest.fn().mockResolvedValue(null);
      await expectError(controller.deleteCostEntry, { params: { costId: VALID_OID } }, 404, {
        error: 'Cost entry not found',
      });
    });

    test('A.28 — returns 200 on success and invalidates cache', async () => {
      Cost.findById = jest.fn().mockResolvedValue({ _id: VALID_OID });
      Cost.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
      const { res } = await callController(controller.deleteCostEntry, {
        params: { costId: VALID_OID },
      });
      expect(Cost.deleteOne).toHaveBeenCalledWith({ _id: VALID_OID });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Cost entry deleted successfully' });
      expect(cache.clearByPrefix).toHaveBeenCalledWith('cost_breakdown:');
      expect(cache.clearByPrefix).toHaveBeenCalledWith('costs_project:');
    });

    test('A.29 — returns 500 when findById throws', async () => {
      Cost.findById = jest.fn().mockRejectedValue(new Error('db error'));
      await expectError(controller.deleteCostEntry, { params: { costId: VALID_OID } }, 500, {
        error: 'Failed to delete cost entry',
      });
      expect(logger.logException).toHaveBeenCalled();
    });

    test('A.29b — returns 500 when deleteOne throws', async () => {
      Cost.findById = jest.fn().mockResolvedValue({ _id: VALID_OID });
      Cost.deleteOne = jest.fn().mockRejectedValue(new Error('delete error'));
      await expectError(controller.deleteCostEntry, { params: { costId: VALID_OID } }, 500, {
        error: 'Failed to delete cost entry',
      });
    });
  });

  // ========================
  // getCostsByProject
  // ========================
  describe('getCostsByProject', () => {
    test('A.30 — returns 400 for invalid projectId', async () => {
      await expectError(controller.getCostsByProject, { params: { projectId: INVALID_OID } }, 400, {
        error: 'Invalid project ID format',
      });
    });

    test('A.31 — returns 400 when project not found', async () => {
      mockProjectNotFound();
      await expectError(controller.getCostsByProject, { params: { projectId: VALID_OID } }, 400, {
        error: 'Project not found',
      });
    });

    test('A.32 — returns 200 with cached response on cache hit', async () => {
      cache.hasCache.mockReturnValue(true);
      const cachedData = { costs: [], pagination: {} };
      cache.getCache.mockReturnValue(cachedData);
      const { res } = await callController(controller.getCostsByProject, {
        params: { projectId: VALID_OID },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(cachedData);
    });

    test('A.33 — returns 200 with costs and pagination', async () => {
      cache.hasCache.mockReturnValue(false);
      mockProjectFound({ _id: VALID_OID, name: 'Test' });
      const mockCosts = [{ _id: '1', amount: 100 }];
      mockCostFindPaginated(mockCosts, 1);
      const { res } = await callController(controller.getCostsByProject, {
        params: { projectId: VALID_OID },
        query: { page: '1', limit: '10' },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.costs).toEqual(mockCosts);
      expect(response.pagination).toBeDefined();
      expect(response.pagination.totalCosts).toBe(1);
      expect(response.pagination.currentPage).toBe(1);
      expect(cache.setCache).toHaveBeenCalled();
    });

    test.each([
      ['category filter', { category: 'Total Cost of Labor' }],
      ['invalid category (ignored)', { category: 'Not A Real Category' }],
    ])('A.34 — returns 200 with %s', async (_, query) => {
      cache.hasCache.mockReturnValue(false);
      mockProjectFound({ _id: VALID_OID, name: 'Test' });
      mockCostFindPaginated([], 0);
      const { res } = await callController(controller.getCostsByProject, {
        params: { projectId: VALID_OID },
        query,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('A.35 — returns 500 when find throws', async () => {
      cache.hasCache.mockReturnValue(false);
      mockProjectFound({ _id: VALID_OID, name: 'Test' });
      Cost.countDocuments = jest.fn().mockRejectedValue(new Error('count error'));
      await expectError(controller.getCostsByProject, { params: { projectId: VALID_OID } }, 500, {
        error: 'Failed to fetch costs for project',
      });
      expect(logger.logException).toHaveBeenCalled();
    });

    test('A.extra — default page/limit when not provided', async () => {
      cache.hasCache.mockReturnValue(false);
      mockProjectFound({ _id: VALID_OID, name: 'Test' });
      mockCostFindPaginated([], 50);
      const { res } = await callController(controller.getCostsByProject, {
        params: { projectId: VALID_OID },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.pagination.currentPage).toBe(1);
      expect(response.pagination.limit).toBe(20);
    });

    test('A.extra — page limit capped at MAX_PAGE_LIMIT (100)', async () => {
      cache.hasCache.mockReturnValue(false);
      mockProjectFound({ _id: VALID_OID, name: 'Test' });
      mockCostFindPaginated([], 0);
      const { res } = await callController(controller.getCostsByProject, {
        params: { projectId: VALID_OID },
        query: { limit: '999' },
      });
      expect(res.json.mock.calls[0][0].pagination.limit).toBe(100);
    });
  });

  // ========================
  // refreshCosts
  // ========================
  describe('refreshCosts', () => {
    test('A.36 — returns 403 for non-admin', async () => {
      const { res } = await callController(controller.refreshCosts, {
        body: { requestor: { role: 'Volunteer' } },
      });
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('A.37 — returns 400 when projectIds not array', async () => {
      await expectError(controller.refreshCosts, { body: { projectIds: 'not-array' } }, 400, {
        error: 'projectIds must be an array',
      });
    });

    test('A.38 — returns 400 when invalid id in projectIds', async () => {
      const { res } = await callController(controller.refreshCosts, {
        body: { projectIds: [VALID_OID, INVALID_OID] },
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toMatch(/Invalid project ID/);
    });

    test('A.39 — returns 200 on success with no projectIds', async () => {
      runCostAggregation.mockResolvedValue({ updated: 5, errors: [] });
      const { res } = await callController(controller.refreshCosts, { body: {} });
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
      const { res } = await callController(controller.refreshCosts, {
        body: { projectIds: [VALID_OID, VALID_OID_2] },
      });
      expect(runCostAggregation).toHaveBeenCalledWith([VALID_OID, VALID_OID_2]);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].updated).toBe(2);
    });

    test('A.41 — returns 500 when runCostAggregation throws', async () => {
      runCostAggregation.mockRejectedValue(new Error('agg error'));
      await expectError(controller.refreshCosts, { body: {} }, 500, {
        error: 'Failed to refresh costs',
      });
      expect(logger.logException).toHaveBeenCalled();
    });
  });
});
