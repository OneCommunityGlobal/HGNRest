const { ObjectId } = require('mongoose').Types;
const Logger = require('../../startup/logger');
const cacheClosure = require('../../utilities/nodeCache');
const { parseDateFlexibleUTC } = require('../../utilities/bmDateUtils');

const isMongoConnectionError = (error) =>
  error.name === 'MongoNetworkError' ||
  error.name === 'MongoTimeoutError' ||
  error.name === 'MongoServerError' ||
  error.message?.includes('ECONNREFUSED') ||
  error.message?.includes('connection') ||
  error.code === 'ETIMEDOUT';

const ERROR_MESSAGES = {
<<<<<<< HEAD
=======
  // Note: INVALID_PROJECT_ID_FORMAT removed - handled by express-validator in router
>>>>>>> 587c381e (fix(api): standardize error response format and remove redundant validation)
  INVALID_START_DATE: (startDate) =>
    `Invalid startDate '${startDate}'. Please use YYYY-MM-DD format or ISO 8601 date string.`,
  INVALID_END_DATE: (endDate) =>
    `Invalid endDate '${endDate}'. Please use YYYY-MM-DD format or ISO 8601 date string.`,
  INVALID_DATE_RANGE: 'Invalid date range: endDate must be greater than or equal to startDate.',
  PROJECT_NOT_FOUND: (projectId) =>
    `Project with ID '${projectId}' not found. Please verify the project ID and try again.`,
  DATABASE_QUERY_FAILED_DATA:
    'Database query failed: unable to fetch tool stoppage data. Please try again or contact support if the issue persists.',
  DATABASE_QUERY_FAILED_PROJECTS:
    'Database query failed: unable to fetch project list. Please try again or contact support if the issue persists.',
  DATABASE_UNAVAILABLE:
    'Database service is temporarily unavailable. Please try again in a few moments.',
};

const CACHE_KEYS = {
  PROJECT_LIST: 'tool-stoppage-reason-projects',
};

const handleControllerError = (
  error,
  res,
  startTime,
  transactionName,
  requestContext,
  errorMessage,
) => {
  const executionTimeMs = Date.now() - startTime;
  Logger.logException(error, transactionName, { ...requestContext, executionTimeMs });
  if (isMongoConnectionError(error)) {
    return res.status(503).json({
      success: false,
      error: ERROR_MESSAGES.DATABASE_UNAVAILABLE,
      executionTimeMs,
      retry: true,
    });
  }
  return res.status(500).json({
    success: false,
    error: errorMessage,
    executionTimeMs,
  });
};

const toolStoppageReasonController = function (ToolStoppageReason) {
  const cache = cacheClosure();
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

  const getToolsStoppageReason = async (req, res) => {
    const startTime = Date.now();
    try {
      const { id: projectId } = req.params;
      const { startDate, endDate } = req.query;

<<<<<<< HEAD
      if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID format' });
      }
=======
      // Note: ObjectId format validation is handled by express-validator in router
>>>>>>> 587c381e (fix(api): standardize error response format and remove redundant validation)

      const parsedStartDate = startDate ? parseDateFlexibleUTC(startDate) : null;
      const parsedEndDate = endDate ? parseDateFlexibleUTC(endDate) : null;

      if (startDate && !parsedStartDate) {
        return res.status(400).json({
          success: false,
          error: ERROR_MESSAGES.INVALID_START_DATE(startDate),
          executionTimeMs: Date.now() - startTime,
        });
      }

      if (endDate && !parsedEndDate) {
        return res.status(400).json({
          success: false,
          error: ERROR_MESSAGES.INVALID_END_DATE(endDate),
          executionTimeMs: Date.now() - startTime,
        });
      }

      if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
        return res.status(400).json({
          success: false,
          error: ERROR_MESSAGES.INVALID_DATE_RANGE,
          executionTimeMs: Date.now() - startTime,
        });
      }

<<<<<<< HEAD
      const matchStage = buildProjectDateMatchStage(projectId, startDate, endDate);
=======
      // Validate project existence
      const projectExists = await BuildingProject.exists({ _id: projectId });
      if (!projectExists) {
        return res.status(404).json({
          success: false,
          error: ERROR_MESSAGES.PROJECT_NOT_FOUND(projectId),
          executionTimeMs: Date.now() - startTime,
        });
      }
>>>>>>> 587c381e (fix(api): standardize error response format and remove redundant validation)

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

      const executionTimeMs = Date.now() - startTime;

      if (executionTimeMs > 1000) {
        Logger.logInfo(`Slow query detected in getToolsStoppageReason: ${executionTimeMs}ms`, {
          projectId,
          startDate,
          endDate,
          executionTimeMs,
        });
      }

      return res.json({
        success: true,
        data: results,
        count: results.length,
        message:
          results.length === 0 ? 'No tool stoppage data found for the specified criteria' : null,
        executionTimeMs,
      });
    } catch (error) {
      const { id: projectId } = req.params;
      const { startDate, endDate } = req.query;
      return handleControllerError(
        error,
        res,
        startTime,
        'GET /api/bm/projects/:id/tools-stoppage-reason - getToolsStoppageReason',
        {
          projectId,
          startDate,
          endDate,
          url: req.originalUrl,
          method: req.method,
          errorType: error.name,
        },
        ERROR_MESSAGES.DATABASE_QUERY_FAILED_DATA,
      );
    }
  };

  const getUniqueProjectIds = async (req, res) => {
    const startTime = Date.now();
    try {
      const cacheKey = CACHE_KEYS.PROJECT_LIST;
      const cachedData = cache.getCache(cacheKey);
      if (cache.hasCache(cacheKey) && cachedData) {
        const executionTimeMs = Date.now() - startTime;
        return res.json({ ...cachedData, executionTimeMs, cached: true });
      }

      const results = await ToolStoppageReason.aggregate([
        { $group: { _id: '$projectId' } },
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
        { $sort: { projectName: 1 } },
      ]);

      const formattedResults = results.map((item) => ({
        projectId: item._id,
        projectName: item.projectName || 'Unknown Project',
      }));

      const executionTimeMs = Date.now() - startTime;

      if (executionTimeMs > 1000) {
        Logger.logInfo(`Slow query detected in getUniqueProjectIds: ${executionTimeMs}ms`, {
          executionTimeMs,
        });
      }

      const response = {
        success: true,
        data: formattedResults,
        count: formattedResults.length,
        message: formattedResults.length === 0 ? 'No projects with tool stoppage data found' : null,
        executionTimeMs,
        cached: false,
      };

      cache.setCache(cacheKey, response);
      return res.json(response);
    } catch (error) {
      return handleControllerError(
        error,
        res,
        startTime,
        'GET /api/bm/tools-stoppage-reason/projects - getUniqueProjectIds',
        { url: req.originalUrl, method: req.method, errorType: error.name },
        ERROR_MESSAGES.DATABASE_QUERY_FAILED_PROJECTS,
      );
    }
  };

  return {
    getToolsStoppageReason,
    getUniqueProjectIds,
  };
};

module.exports = toolStoppageReasonController;