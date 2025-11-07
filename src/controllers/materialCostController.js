const mongoose = require('mongoose');
const NodeCache = require('node-cache');
const BuildingMaterial = require('../models/bmdashboard/buildingMaterial');

const cache = new NodeCache({ stdTTL: 7200 }); // Cache for 2 hour

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

      const matchStage = {
        'purchaseRecord.status': 'Approved',
      };

      if (projectId) {
        const projectIdsObject = normalizedIds
          .split(',')
          .map((id) => new mongoose.Types.ObjectId(id));
        matchStage.project = { $in: projectIdsObject };
      }

      const data = await BuildingMaterial.aggregate([
        { $unwind: '$purchaseRecord' },
        { $match: matchStage },
        {
          $group: {
            _id: '$project',
            totalCost: {
              $sum: {
                $multiply: ['$purchaseRecord.unitPrice', '$purchaseRecord.quantity'],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            project: '$_id',
            totalCostK: { $round: [{ $divide: ['$totalCost', 1000] }, 1] },
          },
        },
      ]);
      cache.set(cacheKey, data);
      res.json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  },
});
