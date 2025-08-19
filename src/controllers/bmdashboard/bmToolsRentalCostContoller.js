const { ObjectId } = require('mongoose').Types;

const bmToolsRentalCostController = function (toolRentalUsageCost) {
  const getRentalsCostOverTime = async (req, res) => {
    try {
      const { projectId, startDate, endDate } = req.query;

      console.log('Received request with params:', { projectId, startDate, endDate });
      // Validate project ID format
      if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID format' });
      }

      // Build date filter based on what's provided
      let dateFilter = {};

      if (startDate && endDate) {
        // If both dates are provided, use them as range
        dateFilter = {
          date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      } else if (startDate) {
        // If only start date is provided, use it as lower bound
        dateFilter = {
          date: { $gte: new Date(startDate) },
        };
      } else if (endDate) {
        // If only end date is provided, use it as upper bound
        dateFilter = {
          date: { $lte: new Date(endDate) },
        };
      }
      // If no dates are provided, don't filter by date at all

      // Query the database for tool availability data
      const results = await toolRentalUsageCost.aggregate([
        {
          $match: {
            projectId: new ObjectId(projectId),
            isRented: true, // Only consider rented tools
            ...dateFilter,
          },
        },
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

      // If no results found, return empty array
      if (!results || results.length === 0) {
        return res.json([]);
      }

      return res.json(results);
    } catch (error) {
      console.error('Error fetching tools rental data:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  const getToolsCostBreakdown = async (req, res) => {
    try {
      const { startDate, endDate, projectIds } = req.query;
      const projectList = projectIds.split(','); // ["proj1", "proj2"]

      const data = await toolRentalUsageCost.aggregate([
        {
          $match: {
            projectName: { $in: projectList },
            date: {
              $gte: new Date(startDate),
              $lte: new Date(endDate),
            },
          },
        },
        {
          $group: {
            _id: '$projectName',
            ownedToolsCost: {
              $sum: {
                $cond: [{ $eq: ['$isRented', false] }, '$cost', 0],
              },
            },
            rentedToolsCost: {
              $sum: {
                $cond: [{ $eq: ['$isRented', true] }, '$cost', 0],
              },
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
      res.status(500).json({ error: 'Failed to fetch tools cost breakdown.' });
    }
  };

  // Fetch unique projects
  const getUniqueProjects = async (req, res) => {
    try {
      const projects = await toolRentalUsageCost.aggregate([
        {
          $group: {
            _id: '$projectId', // group by ObjectId
            projectName: { $first: '$projectName' }, // keep project name
          },
        },
        {
          $project: {
            _id: 0,
            projectId: '$_id', // rename _id back to projectId
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
