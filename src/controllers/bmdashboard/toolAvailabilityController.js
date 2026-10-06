const mongoose = require('mongoose');
const BuildingProject = require('../../models/bmdashboard/buildingProject');

const { ObjectId } = mongoose.Types;
const toolAvailabilityController = function (ToolAvailability) {
  const getToolsAvailability = async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const { startDate, endDate } = req.query;

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
      const results = await ToolAvailability.aggregate([
        {
          $match: {
            projectId: new ObjectId(projectId),
            ...dateFilter,
          },
        },
        {
          $group: {
            _id: {
              toolName: '$toolName',
              status: '$status',
            },
            totalQuantity: { $sum: '$quantity' },
          },
        },
        {
          $group: {
            _id: '$_id.toolName',
            statusCounts: {
              $push: {
                status: '$_id.status',
                quantity: '$totalQuantity',
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            toolName: '$_id',
            inUse: {
              $reduce: {
                input: {
                  $filter: {
                    input: '$statusCounts',
                    as: 'count',
                    cond: { $eq: ['$$count.status', 'In Use'] },
                  },
                },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.quantity'] },
              },
            },
            needsReplacement: {
              $reduce: {
                input: {
                  $filter: {
                    input: '$statusCounts',
                    as: 'count',
                    cond: { $eq: ['$$count.status', 'Needs to be replaced'] },
                  },
                },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.quantity'] },
              },
            },
            yetToReceive: {
              $reduce: {
                input: {
                  $filter: {
                    input: '$statusCounts',
                    as: 'count',
                    cond: { $eq: ['$$count.status', 'Yet to receive'] },
                  },
                },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.quantity'] },
              },
            },
          },
        },
      ]);

      // If no results found, return empty array
      if (!results || results.length === 0) {
        return res.json([]);
      }

      return res.json(results);
    } catch (error) {
      console.error('Error fetching tools availability:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  const getUniqueProjectIds = async (req, res) => {
    try {
      // Get the unique project IDs that actually have tool availability data.
      const projectIds = await ToolAvailability.distinct('projectId');

      // Only return projects that still exist in the BuildingProject collection.
      const projects = await BuildingProject.find({
        _id: { $in: projectIds },
      })
        .select('_id name')
        .sort({ name: 1 })
        .lean();

      const formattedResults = projects.map((project) => ({
        projectId: project._id,
        projectName: project.name,
      }));

      return res.json(formattedResults);
    } catch (error) {
      console.error('Error fetching unique project IDs:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  return {
    getToolsAvailability,
    getUniqueProjectIds,
  };
};

module.exports = toolAvailabilityController;
