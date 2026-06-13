const { ObjectId } = require('mongoose').Types;

const toolStoppageReasonController = function (ToolStoppageReason) {
  const stoppageReasonFields = ['usedForLifetime', 'damaged', 'lost'];

  const createPercentageProjection = (field) => ({
    $cond: [
      { $gt: ['$total', 0] },
      {
        $round: [
          {
            $multiply: [{ $divide: [`$${field}`, '$total'] }, 100],
          },
          2,
        ],
      },
      0,
    ],
  });

  const buildProjectDateMatchStage = (projectId, startDate, endDate) => {
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

    return matchStage;
  };

  const buildProjectIdAggregation = (collectionName, projectNameField) => [
    {
      $group: {
        _id: '$projectId',
      },
    },
    {
      $lookup: {
        from: collectionName,
        localField: '_id',
        foreignField: '_id',
        as: 'projectDetails',
      },
    },
    {
      $project: {
        _id: 1,
        projectName: { $arrayElemAt: [`$projectDetails.${projectNameField}`, 0] },
      },
    },
    {
      $sort: { projectName: 1 },
    },
  ];

  const getToolsStoppageReason = async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const { startDate, endDate } = req.query;

      if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID format' });
      }

      const matchStage = buildProjectDateMatchStage(projectId, startDate, endDate);

      const groupSums = stoppageReasonFields.reduce(
        (accumulator, field) => ({
          ...accumulator,
          [field]: { $sum: `$${field}` },
        }),
        {},
      );

      const percentageProjection = stoppageReasonFields.reduce(
        (accumulator, field) => ({
          ...accumulator,
          [field]: createPercentageProjection(field),
        }),
        {},
      );

      const results = await ToolStoppageReason.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$toolName',
            ...groupSums,
          },
        },
        {
          $addFields: {
            total: {
              $add: stoppageReasonFields.map((field) => `$${field}`),
            },
          },
        },
        {
          $project: {
            _id: 0,
            toolName: '$_id',
            ...percentageProjection,
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
      const results = await ToolStoppageReason.aggregate(
        buildProjectIdAggregation('buildingProjects', 'name'),
      );

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
