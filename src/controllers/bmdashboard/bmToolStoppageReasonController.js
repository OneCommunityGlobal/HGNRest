const { ObjectId } = require('mongoose').Types;
const Logger = require('../../startup/logger');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const cacheClosure = require('../../utilities/nodeCache');

// Date parsing helpers (consistent with injuryCategoryController.js)
const parseYmdUtc = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, 0, 0, 0, 0));
};

const parseDateFlexibleUTC = (s) => {
  const d1 = parseYmdUtc(s);
  if (d1) return d1;
  if (!s) return null;
  const d2 = new Date(s);
  return Number.isNaN(d2.getTime()) ? null : d2;
};

const toolStoppageReasonController = function (ToolStoppageReason) {
  const stoppageReasonFields = ['usedForLifetime', 'damaged', 'lost'];
  const cache = cacheClosure();

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
        return res.status(400).json({
          error: `Project ID '${projectId}' is not a valid ObjectId format. Please provide a valid 24-character hexadecimal string.`,
        });
      }

// Validate date formats
      const parsedStartDate = startDate ? parseDateFlexibleUTC(startDate) : null;
      const parsedEndDate = endDate ? parseDateFlexibleUTC(endDate) : null;

      if (startDate && !parsedStartDate) {
        return res.status(400).json({
          error: `Invalid startDate '${startDate}'. Please use YYYY-MM-DD format or ISO 8601 date string.`,
        });
      }

      if (endDate && !parsedEndDate) {
        return res.status(400).json({
          error: `Invalid endDate '${endDate}'. Please use YYYY-MM-DD format or ISO 8601 date string.`,
        });
      }

      if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
        return res.status(400).json({
          error: 'Invalid date range: endDate must be greater than or equal to startDate.',
        });
      }

      const projectExists = await BuildingProject.exists({ _id: projectId });
      if (!projectExists) {
        return res.status(404).json({
          error: `Project with ID '${projectId}' not found. Please verify the project ID and try again.`,
        });
      }

      const matchStage = { projectId: new ObjectId(projectId) };
      if (parsedStartDate || parsedEndDate) {
        matchStage.date = {};
        if (parsedStartDate) matchStage.date.$gte = parsedStartDate;
        if (parsedEndDate) matchStage.date.$lte = parsedEndDate;
      }

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
      // Define cache key for project list
      const cacheKey = 'tool-stoppage-reason-projects';

      // Check if cached data exists (TTL: 300s / 5 minutes)
      if (cache.hasCache(cacheKey)) {
        return res.json(cache.getCache(cacheKey));
      }

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

      const formattedResults = results.map((item) => ({
        projectId: item._id,
        projectName: item.projectName || 'Unknown Project',
      }));

      // Cache the response for 5 minutes (default TTL: 300s)
      cache.setCache(cacheKey, formattedResults);

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
