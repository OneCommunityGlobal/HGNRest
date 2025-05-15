// controllers/materialCostController.js
const redis         = require('../utilities/projectStatusCache'); // same helper
const MaterialCost  = require('../models/materialCost');

module.exports = () => ({
  // ──────────────────────────────────────────
  // GET /api/projects
  // ──────────────────────────────────────────
  getProjects: async (req, res, next) => {
    try {
      const cacheKey   = 'materialCost:projects';
      const cachedData = await redis.get(cacheKey);
      if (cachedData) return res.json(JSON.parse(cachedData));

      const projects = await MaterialCost.aggregate([
        { $group: { _id: { projectId: '$projectId', projectName: '$projectName' } } },
        { $project: { _id: 0, projectId: '$_id.projectId', projectName: '$_id.projectName' } },
        { $sort: { projectName: 1 } },
      ]);

      await redis.set(cacheKey, JSON.stringify(projects), 'EX', 3600); // 1 hour
      res.json(projects);
    } catch (err) { next(err); }
  },

  // ──────────────────────────────────────────
  // GET /api/material-costs?projectIds=PRJ001,PRJ002
  // Returns [{ projectId, totalCostK }]
  // ──────────────────────────────────────────
  getMaterialCosts: async (req, res, next) => {
    try {
      const { projectIds } = req.query;                    // comma‑separated list
      const normalizedIds  = projectIds
        ? projectIds.split(',').map(id => id.trim()).sort().join(',')
        : 'all';

      const cacheKey   = `materialCost:costs:${normalizedIds}`;
      const cachedData = await redis.get(cacheKey);
      if (cachedData) return res.json(JSON.parse(cachedData));

      const matchStage = projectIds
        ? [{ $match: { projectId: { $in: normalizedIds.split(',') } } }]
        : [];

      const data = await MaterialCost.aggregate([
        ...matchStage,
        {
          $group: {
            _id: '$projectId',
            totalCost: { $sum: '$totalMaterialCost' },
          },
        },
        {
          $project: {
            _id: 0,
            projectId:  '$_id',
            totalCostK: { $round: [{ $divide: ['$totalCost', 1000] }, 1] }, // $ → $ 1000s
          },
        },
        { $sort: { projectId: 1 } },
      ]);

      await redis.set(cacheKey, JSON.stringify(data), 'EX', 3600); // 1 hour
      res.json(data);
    } catch (err) { next(err); }
  },
});
