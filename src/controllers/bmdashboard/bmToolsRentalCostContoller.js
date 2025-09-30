const { ObjectId } = require('mongoose').Types;

const bmToolsRentalCostController = function (toolRentalUsageCost) {
  const getRentalsCostOverTime = async (req, res) => {
    try {
      const { projectId, startDate, endDate } = req.query;

      // Validate project ID format if provided
      if (projectId && !ObjectId.isValid(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID format' });
      }

      // Base query
      const matchQuery = { isRented: true };

      if (projectId) {
        matchQuery.projectId = new ObjectId(projectId);
      }

      // Add date filter only if valid dates are provided
      const hasValidStartDate = startDate && !Number.isNaN(new Date(startDate).getTime());
      const hasValidEndDate = endDate && !Number.isNaN(new Date(endDate).getTime());

      if (hasValidStartDate && hasValidEndDate) {
        matchQuery.date = {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };
      } else if (hasValidStartDate) {
        matchQuery.date = { $gte: new Date(startDate) };
      } else if (hasValidEndDate) {
        matchQuery.date = { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
      }

      // Aggregate rental costs by date
      const data = await toolRentalUsageCost.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$date',
            value: { $sum: '$cost' },
          },
        },
        {
          $project: {
            _id: 0,
            date: { $dateToString: { format: '%Y-%m-%d', date: '$_id' } },
            value: 1,
          },
        },
        { $sort: { date: 1 } },
      ]);

      // Return empty array if no results
      if (!data || data.length === 0) {
        return res.json([]);
      }

      return res.json(data);
    } catch (error) {
      console.error('Error fetching tools rental data:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Cost breakdown by owned vs rented tools
  const getToolsCostBreakdown = async (req, res) => {
    try {
      const { startDate, endDate, projectIds } = req.query;

      const matchFilter = {};

      // Handle projectIds if provided
      if (projectIds) {
        const projectList = projectIds.split(','); // ["proj1", "proj2"]
        matchFilter.projectName = { $in: projectList };
      }

      // Handle dates only if valid
      const hasValidStartDate = startDate && !Number.isNaN(new Date(startDate).getTime());
      const hasValidEndDate = endDate && !Number.isNaN(new Date(endDate).getTime());

      if (hasValidStartDate && hasValidEndDate) {
        matchFilter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      } else if (hasValidStartDate) {
        matchFilter.date = { $gte: new Date(startDate) };
      } else if (hasValidEndDate) {
        matchFilter.date = { $lte: new Date(endDate) };
      }

      const data = await toolRentalUsageCost.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$projectName',
            ownedToolsCost: {
              $sum: { $cond: [{ $eq: ['$isRented', false] }, '$cost', 0] },
            },
            rentedToolsCost: {
              $sum: { $cond: [{ $eq: ['$isRented', true] }, '$cost', 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            projectName: '$_id',
            ownedToolsCost: 1,
            rentedToolsCost: 1,
          },
        },
      ]);

      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch tools cost breakdown.' });
    }
  };

  // Unique projects
  const getUniqueProjects = async (req, res) => {
    try {
      const projects = await toolRentalUsageCost.aggregate([
        {
          $group: {
            _id: '$projectId',
            projectName: { $first: '$projectName' },
          },
        },
        {
          $project: {
            _id: 0,
            projectId: '$_id',
            projectName: 1,
          },
        },
      ]);

      res.status(200).json({ projects });
    } catch (error) {
      console.error('Error fetching unique projects:', error);
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getRentalsCostOverTime,
    getToolsCostBreakdown,
    getUniqueProjects,
  };
};

module.exports = bmToolsRentalCostController;
