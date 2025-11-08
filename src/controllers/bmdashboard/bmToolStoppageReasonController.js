const { ObjectId } = require('mongoose').Types;
const Logger = require('../../startup/logger');

const toolStoppageReasonController = function (ToolStoppageReason) {
  const getToolsStoppageReason = async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const { startDate, endDate } = req.query;

      // Validate project ID format
      if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({
          error: `Project ID '${projectId}' is not a valid ObjectId format. Please provide a valid 24-character hexadecimal string.`,
        });
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
      const results = await ToolStoppageReason.aggregate([
        {
          $match: {
            projectId: new ObjectId(projectId),
            ...dateFilter,
          },
        },
      ]);

      // If no results found, return empty array
      if (!results || results.length === 0) {
        return res.json([]);
      }

      return res.json(results);
    } catch (error) {
      const { id: projectId } = req.params;
      const { startDate, endDate } = req.query;
      const transactionName =
        'GET /api/bm/projects/:id/tools-stoppage-reason - getToolsStoppageReason';
      const requestContext = {
        projectId,
        startDate,
        endDate,
        url: req.originalUrl,
        method: req.method,
      };

      Logger.logException(error, transactionName, requestContext);

      return res.status(500).json({
        error:
          'Database query failed: unable to fetch tool stoppage data. Please try again or contact support if the issue persists.',
      });
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
      const transactionName = 'GET /api/bm/tools-stoppage-reason/projects - getUniqueProjectIds';
      const requestContext = {
        url: req.originalUrl,
        method: req.method,
      };

      Logger.logException(error, transactionName, requestContext);

      return res.status(500).json({
        error:
          'Database query failed: unable to fetch project list. Please try again or contact support if the issue persists.',
      });
    }
  };

  return {
    getToolsStoppageReason,
    getUniqueProjectIds,
  };
};

module.exports = toolStoppageReasonController;
