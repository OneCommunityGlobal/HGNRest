const NodeCache = require('node-cache');
const Project = require('../models/bmdashboard/project');

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
      filter.start_date = {};
      if (startDate) filter.start_date.$gte = new Date(startDate);
      if (endDate) filter.start_date.$lte = new Date(endDate);
    }

    const data = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    let total = 0;
    const summary = { active: 0, completed: 0, delayed: 0 };

    data.forEach((item) => {
      summary[item._id] = item.count;
      total += item.count;
    });

    const response = {
      totalProjects: total,
      activeProjects: summary.active,
      completedProjects: summary.completed,
      delayedProjects: summary.delayed,
      percentages: {
        active: total ? ((summary.active / total) * 100).toFixed(1) : 0,
        completed: total ? ((summary.completed / total) * 100).toFixed(1) : 0,
        delayed: total ? ((summary.delayed / total) * 100).toFixed(1) : 0,
      },
    };

    cache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    console.error('Error fetching project status summary:', error);
    res.status(500).json({ message: 'Failed to retrieve project status summary' });
  }
};
