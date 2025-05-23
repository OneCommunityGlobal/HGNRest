const { ObjectId } = require('mongoose').Types;

const toolAvailabilityController = function (ToolAvailability) {
  const getToolsAvailability = async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const { startDate, endDate } = req.query;

      // Parse dates from query parameters
      const startDateTime = startDate
        ? new Date(startDate)
        : new Date(new Date().setMonth(new Date().getMonth() - 1));
      const endDateTime = endDate ? new Date(endDate) : new Date();

      // Validate project ID format
      if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID format' });
      }

      // Query the database for tool availability data
      const results = await ToolAvailability.aggregate([
        {
          $match: {
            projectId: new ObjectId(projectId),
            date: { $gte: startDateTime, $lte: endDateTime },
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

  return {
    getToolsAvailability,
  };
};

module.exports = toolAvailabilityController;
