const { ObjectId } = require('mongoose').Types;

const toolStoppageReasonController = function (ToolStoppageReason) {
  const getToolsStoppageReason = async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const { startDate, endDate } = req.query;

      if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID format' });
      }

      const matchStage = {
        projectId: new ObjectId(projectId),
      };

      if (startDate || endDate) {
        matchStage.date = {};
        if (startDate) {
          matchStage.date.$gte = new Date(startDate);
        }
        if (endDate) {
          matchStage.date.$lte = new Date(endDate);
        }
      }

      const results = await ToolStoppageReason.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$toolName',
            usedForLifetime: { $sum: '$usedForLifetime' },
            damaged: { $sum: '$damaged' },
            lost: { $sum: '$lost' },
          },
        },
        {
          $addFields: {
            total: { $add: ['$usedForLifetime', '$damaged', '$lost'] },
          },
        },
        {
          $project: {
            _id: 0,
            toolName: '$_id',
            usedForLifetime: {
              $cond: [
                { $gt: ['$total', 0] },
                {
                  $round: [
                    {
                      $multiply: [{ $divide: ['$usedForLifetime', '$total'] }, 100],
                    },
                    2,
                  ],
                },
                0,
              ],
            },
            damaged: {
              $cond: [
                { $gt: ['$total', 0] },
                {
                  $round: [
                    {
                      $multiply: [{ $divide: ['$damaged', '$total'] }, 100],
                    },
                    2,
                  ],
                },
                0,
              ],
            },
            lost: {
              $cond: [
                { $gt: ['$total', 0] },
                {
                  $round: [
                    {
                      $multiply: [{ $divide: ['$lost', '$total'] }, 100],
                    },
                    2,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { toolName: 1 } },
      ]);

      return res.json(results);
    } catch (error) {
      console.error('Error fetching tools stoppage reason:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  const getUniqueProjectIds = async (req, res) => {
    try {
      // Use aggregation to get distinct project IDs and lookup their names
      const results = await ToolStoppageReason.aggregate([
        {
          $group: {
            _id: '$projectId',
          },
        },
        {
          $lookup: {
            from: 'buildingProjects',
            localField: '_id',
            foreignField: '_id',
            as: 'projectDetails',
          },
        },
        {
          $project: {
            _id: 1,
            projectName: { $arrayElemAt: ['$projectDetails.name', 0] },
          },
        },
        {
          $sort: { projectName: 1 },
        },
      ]);

      // Format the response
      const formattedResults = results.map((item) => ({
        projectId: item._id,
        projectName: item.projectName || 'Unknown Project',
      }));

      return res.json(formattedResults);
    } catch (error) {
      console.error('Error fetching unique project IDs:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  return {
    getToolsStoppageReason,
    getUniqueProjectIds,
  };
};

module.exports = toolStoppageReasonController;
