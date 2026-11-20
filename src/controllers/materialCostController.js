const cache = require('../utilities/cache');
const {
  getMaterialPurchaseCostByProject,
} = require('../services/bmdashboard/materialPurchaseCostService');

const COST_IN_THOUSANDS = 1000;

module.exports = () => ({
  getMaterialCosts: async (req, res) => {
    try {
      const { projectId } = req.query;
      const normalizedIds = projectId
        ? projectId
            .split(',')
            .map((id) => id.trim())
            .sort()
            .join(',')
        : 'all';
      const cacheKey = `materialCost${normalizedIds}`;
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      const costs = await getMaterialPurchaseCostByProject({
        projectIds: projectId ? normalizedIds.split(',') : undefined,
      });
      const data = costs.map(({ project, totalCost }) => ({
        project,
        totalCostK: totalCost / COST_IN_THOUSANDS,
      }));
      cache.set(cacheKey, data);
      res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  },
});
