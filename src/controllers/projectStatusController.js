const redis = require('../utilities/projectStatusCache');
const projectStatus = require('../models/projectStatus');

exports.getProjectStatusSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;

    const cacheKey = `projectStatus:${startDate || 'all'}:${endDate || 'all'}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) return res.json(JSON.parse(cachedData));

    const match = {
      ...(parsedStartDate && { startDate: { $gte: parsedStartDate } }),
      ...(parsedEndDate && {
        $or: [
          { completionDate: { $lte: parsedEndDate } },
          { status: 'Active' },
        ],
      }),
    };

    const statusCounts = await projectStatus.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusMap = { Active: 0, Completed: 0, Delayed: 0 };
    statusCounts.forEach(({ _id, count }) => {
      if (_id in statusMap) {
        statusMap[_id] = count;
      }
    });

    const totalProjects = statusMap.Active + statusMap.Completed + statusMap.Delayed;

    const percentages = totalProjects === 0 ? {
      active: 0,
      completed: 0,
      delayed: 0,
    } : {
      active: Number(((statusMap.Active / totalProjects) * 100).toFixed(1)),
      completed: Number(((statusMap.Completed / totalProjects) * 100).toFixed(1)),
      delayed: Number(((statusMap.Delayed / totalProjects) * 100).toFixed(1)),
    };

    const result = {
      totalProjects,
      activeProjects: statusMap.Active,
      completedProjects: statusMap.Completed,
      delayedProjects: statusMap.Delayed,
      percentages,
    };

    await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // 1 hour

    return res.json(result);
  } catch (error) {
    console.error('Error fetching project status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
