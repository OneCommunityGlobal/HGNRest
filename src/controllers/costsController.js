const mongoose = require('mongoose');
const Cost = require('../models/costs');
const { COST_CATEGORIES } = require('../models/costs');
const BuildingProject = require('../models/bmdashboard/buildingProject');
const cache = require('../utilities/nodeCache')();
const logger = require('../startup/logger');
const { runCostAggregation } = require('../services/bmdashboard/costAggregationService');

const CACHE_PREFIX = 'cost_breakdown:';
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

/**
 * Invalidates all cost breakdown cache entries.
 */
function invalidateCostCache() {
  cache.clearByPrefix(CACHE_PREFIX);
  cache.clearByPrefix('costs_project:');
}

const ADMIN_ROLES = new Set(['Administrator', 'Owner']);

/**
 * Checks whether the requestor has admin privileges.
 * Returns true if authorized, false otherwise.
 */
function isAdmin(req) {
  const { requestor } = req.body;
  return requestor && ADMIN_ROLES.has(requestor.role);
}

/**
 * Builds MongoDB match stage for cost queries.
 */
function buildMatchStage(projectId, startDate, endDate) {
  const matchStage = {};
  if (projectId) {
    matchStage.projectId = new mongoose.Types.ObjectId(projectId);
  }
  if (startDate || endDate) {
    matchStage.costDate = {};
    if (startDate) matchStage.costDate.$gte = new Date(startDate);
    if (endDate) matchStage.costDate.$lte = new Date(endDate);
  }
  return matchStage;
}

/**
 * Runs detailed aggregation (with per-project breakdown per category).
 */
async function aggregateWithDetail(matchStage) {
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: { category: '$category', projectId: '$projectId' },
        amount: { $sum: '$amount' },
        projectName: { $first: '$projectName' },
      },
    },
    { $sort: { '_id.category': 1, amount: -1 } },
  ];

  const detailed = await Cost.aggregate(pipeline);

  const categoryMap = new Map();
  COST_CATEGORIES.forEach((cat) => {
    categoryMap.set(cat, { category: cat, amount: 0, projectBreakdown: [] });
  });

  detailed.forEach((row) => {
    const entry = categoryMap.get(row._id.category);
    if (!entry) return;
    entry.amount += row.amount;
    const pid = row._id.projectId;
    entry.projectBreakdown.push({
      projectId: pid && typeof pid.toString === 'function' ? pid.toString() : pid,
      projectName: row.projectName || 'Unknown',
      amount: row.amount,
      percentage: 0,
    });
  });

  const breakdown = [];
  categoryMap.forEach((entry) => {
    if (entry.amount > 0) {
      entry.projectBreakdown.forEach((pb) => {
        pb.percentage = Number.parseFloat(((pb.amount / entry.amount) * 100).toFixed(2));
      });
    }
    breakdown.push(entry);
  });

  breakdown.sort((a, b) => b.amount - a.amount);
  return breakdown;
}

/**
 * Runs simple category-level aggregation.
 */
async function aggregateSimple(matchStage) {
  const pipeline = [
    { $match: matchStage },
    { $group: { _id: '$category', amount: { $sum: '$amount' } } },
    { $project: { _id: 0, category: '$_id', amount: 1 } },
    { $sort: { amount: -1 } },
  ];
  return Cost.aggregate(pipeline);
}

/**
 * Validates breakdown query parameters.
 * Returns { error } or { projectId, startDate, endDate, categoryDetail }.
 */
async function validateBreakdownParams(query) {
  const { projectId, startDate, endDate, categoryDetail } = query;

  if (projectId) {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return { error: 'Invalid project ID format' };
    }
    const exists = await BuildingProject.findById(projectId).lean();
    if (!exists) return { error: 'Project not found' };
  }

  if (startDate && Number.isNaN(Date.parse(startDate))) {
    return { error: 'Invalid startDate' };
  }
  if (endDate && Number.isNaN(Date.parse(endDate))) {
    return { error: 'Invalid endDate' };
  }
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    return { error: 'Invalid date range: startDate must be before endDate' };
  }

  return { projectId, startDate, endDate, categoryDetail };
}

/**
 * GET /api/costs/breakdown
 * Returns cost breakdown by category for the donut chart.
 * Supports optional projectId, startDate, endDate, and categoryDetail query params.
 */
async function getCostBreakdown(req, res) {
  try {
    const validation = await validateBreakdownParams(req.query);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const { projectId, startDate, endDate, categoryDetail } = validation;

    const cacheKey = `${CACHE_PREFIX}${projectId || 'all'}:${startDate || ''}:${endDate || ''}:${categoryDetail || ''}`;
    if (cache.hasCache(cacheKey)) {
      return res.status(200).json(cache.getCache(cacheKey));
    }

    const matchStage = buildMatchStage(projectId, startDate, endDate);

    let projectLabel = 'All Projects';
    if (projectId) {
      const proj = await BuildingProject.findById(projectId).select('name').lean();
      if (proj) projectLabel = proj.name;
    }

    const wantDetail = categoryDetail === 'true' || categoryDetail === true;
    const breakdown = wantDetail
      ? await aggregateWithDetail(matchStage)
      : await aggregateSimple(matchStage);

    const totalCost = breakdown.reduce((sum, item) => sum + item.amount, 0);

    const response = { project: projectLabel, totalCost, breakdown };
    cache.setCache(cacheKey, response);

    return res.status(200).json(response);
  } catch (error) {
    logger.logException(error, 'costsController.getCostBreakdown');
    return res.status(500).json({ error: 'Failed to fetch cost breakdown' });
  }
}

/**
 * POST /api/costs
 * Admin-only: Add a single cost entry (correction or mock data).
 */
async function addCostEntry(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized: Admin access required' });
  }
  try {
    const { category, amount, projectId, costDate } = req.body;

    if (!category || amount === undefined || !projectId) {
      return res.status(400).json({
        error: 'category, amount, and projectId are all required',
      });
    }

    if (!COST_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${COST_CATEGORIES.join(', ')}`,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID format' });
    }

    if (Number.isNaN(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({
        error: 'Amount must be a non-negative number',
      });
    }

    const project = await BuildingProject.findById(projectId).lean();
    if (!project) {
      return res.status(400).json({ error: 'Project not found' });
    }

    const newCost = new Cost({
      category,
      amount: Number(amount),
      projectId,
      costDate: costDate ? new Date(costDate) : new Date(),
      projectName: project.name || 'Unnamed Project',
      projectType: project.projectType || 'private',
      source: 'manual',
    });

    await newCost.save();
    invalidateCostCache();

    return res.status(201).json(newCost);
  } catch (error) {
    logger.logException(error, 'costsController.addCostEntry');
    return res.status(500).json({ error: 'Failed to add cost entry' });
  }
}

/**
 * PUT /api/costs/:costId
 * Admin-only: Update a cost entry.
 */
async function updateCostEntry(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized: Admin access required' });
  }
  try {
    const { costId } = req.params;
    const { category, amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(costId)) {
      return res.status(400).json({ error: 'Invalid cost ID format' });
    }

    if (category && !COST_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${COST_CATEGORIES.join(', ')}`,
      });
    }

    if (amount !== undefined && (Number.isNaN(Number(amount)) || Number(amount) < 0)) {
      return res.status(400).json({
        error: 'Amount must be a non-negative number',
      });
    }

    const cost = await Cost.findById(costId);
    if (!cost) {
      return res.status(404).json({ error: 'Cost entry not found' });
    }

    if (category) cost.category = category;
    if (amount !== undefined) cost.amount = Number(amount);
    cost.lastUpdated = new Date();
    cost.source = 'correction';

    await cost.save();
    invalidateCostCache();

    return res.status(200).json(cost);
  } catch (error) {
    logger.logException(error, 'costsController.updateCostEntry');
    return res.status(500).json({ error: 'Failed to update cost entry' });
  }
}

/**
 * DELETE /api/costs/:costId
 * Admin-only: Remove a cost entry.
 */
async function deleteCostEntry(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized: Admin access required' });
  }
  try {
    const { costId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(costId)) {
      return res.status(400).json({ error: 'Invalid cost ID format' });
    }

    const cost = await Cost.findById(costId);
    if (!cost) {
      return res.status(404).json({ error: 'Cost entry not found' });
    }

    await Cost.deleteOne({ _id: costId });
    invalidateCostCache();

    return res.status(200).json({ message: 'Cost entry deleted successfully' });
  } catch (error) {
    logger.logException(error, 'costsController.deleteCostEntry');
    return res.status(500).json({ error: 'Failed to delete cost entry' });
  }
}

/**
 * GET /api/costs/:projectId
 * Paginated list of cost entries for a building project.
 */
async function getCostsByProject(req, res) {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = DEFAULT_PAGE_LIMIT, category } = req.query;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID format' });
    }

    const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNumber = Math.max(
      1,
      Math.min(MAX_PAGE_LIMIT, Number.parseInt(limit, 10) || DEFAULT_PAGE_LIMIT),
    );

    const cacheKey = `costs_project:${projectId}:${category || 'all'}:${pageNumber}:${limitNumber}`;
    if (cache.hasCache(cacheKey)) {
      return res.status(200).json(cache.getCache(cacheKey));
    }

    const project = await BuildingProject.findById(projectId).lean();
    if (!project) {
      return res.status(400).json({ error: 'Project not found' });
    }

    const query = { projectId: new mongoose.Types.ObjectId(projectId) };
    if (category && COST_CATEGORIES.includes(category)) {
      query.category = category;
    }

    const totalCosts = await Cost.countDocuments(query);

    const costs = await Cost.find(query)
      .sort({ costDate: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean();

    const response = {
      costs,
      pagination: {
        totalCosts,
        totalPages: Math.ceil(totalCosts / limitNumber),
        currentPage: pageNumber,
        limit: limitNumber,
        hasNextPage: pageNumber < Math.ceil(totalCosts / limitNumber),
        hasPreviousPage: pageNumber > 1,
      },
    };

    cache.setCache(cacheKey, response);

    return res.status(200).json(response);
  } catch (error) {
    logger.logException(error, 'costsController.getCostsByProject');
    return res.status(500).json({ error: 'Failed to fetch costs for project' });
  }
}

/**
 * POST /api/costs/refresh
 * Admin-only: Manually trigger cost aggregation.
 * Body: { projectIds?: string[] }
 */
async function refreshCosts(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized: Admin access required' });
  }
  try {
    const { projectIds } = req.body;

    if (projectIds) {
      if (!Array.isArray(projectIds)) {
        return res.status(400).json({ error: 'projectIds must be an array' });
      }
      const invalidId = projectIds.find((id) => !mongoose.Types.ObjectId.isValid(id));
      if (invalidId) {
        return res.status(400).json({ error: `Invalid project ID: ${invalidId}` });
      }
    }

    const aggregationResult = await runCostAggregation(projectIds || null);
    invalidateCostCache();

    return res.status(200).json({
      message: 'Cost aggregation completed',
      updated: aggregationResult.updated,
      errors: aggregationResult.errors,
    });
  } catch (error) {
    logger.logException(error, 'costsController.refreshCosts');
    return res.status(500).json({ error: 'Failed to refresh costs' });
  }
}

function costsController() {
  return {
    getCostBreakdown,
    addCostEntry,
    updateCostEntry,
    deleteCostEntry,
    getCostsByProject,
    refreshCosts,
  };
}

module.exports = costsController;
