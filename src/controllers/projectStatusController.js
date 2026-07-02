const NodeCache = require('node-cache');
const Project = require('../models/project');

const cache = new NodeCache({ stdTTL: 300 });

exports.getProjectStatusSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const cacheKey = `status:${startDate || 'all'}:${endDate || 'all'}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const filter = {};
    if (startDate || endDate) {
      filter.createdDatetime = {};
      if (startDate) filter.createdDatetime.$gte = new Date(startDate);
      if (endDate) filter.createdDatetime.$lte = new Date(endDate);
    }

    const data = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$isActive', true] }, { $ne: ['$isArchived', true] }] },
                1,
                0,
              ],
            },
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$isArchived', true] }, 1, 0] },
          },
          inactive: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$isActive', false] }, { $ne: ['$isArchived', true] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const result = data[0] || { total: 0, active: 0, completed: 0, inactive: 0 };

    const response = {
      totalProjects: result.total,
      activeProjects: result.active,
      completedProjects: result.completed,
      delayedProjects: result.inactive,
      percentages: {
        active: result.total ? ((result.active / result.total) * 100).toFixed(1) : 0,
        completed: result.total ? ((result.completed / result.total) * 100).toFixed(1) : 0,
        delayed: result.total ? ((result.inactive / result.total) * 100).toFixed(1) : 0,
      },
    };

    cache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    console.error('Error fetching project status summary:', error);
    res.status(500).json({ message: 'Failed to retrieve project status summary' });
  }
};
