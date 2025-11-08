const { ObjectId } = require('mongoose').Types;
const Logger = require('../../startup/logger');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const cacheClosure = require('../../utilities/nodeCache');

/**
 * Check if error is a MongoDB connection error
 * @param {Error} error - Error object to check
 * @returns {boolean} True if error is a MongoDB connection error
 */
const isMongoConnectionError = (error) =>
  error.name === 'MongoNetworkError' ||
  error.name === 'MongoTimeoutError' ||
  error.name === 'MongoServerError' ||
  error.message?.includes('ECONNREFUSED') ||
  error.message?.includes('connection') ||
  error.code === 'ETIMEDOUT';

// Error message constants
const ERROR_MESSAGES = {
  INVALID_PROJECT_ID_FORMAT: (projectId) =>
    `Project ID '${projectId}' is not a valid ObjectId format. Please provide a valid 24-character hexadecimal string.`,
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

// Cache key constants
const CACHE_KEYS = {
  PROJECT_LIST: 'tool-stoppage-reason-projects',
};

/**
 * Parse date string in YYYY-MM-DD format to UTC Date object
 * @param {string} s - Date string in YYYY-MM-DD format
 * @returns {Date|null} UTC Date object or null if invalid
 */
const parseYmdUtc = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, 0, 0, 0, 0));
};

/**
 * Parse date string flexibly - tries YYYY-MM-DD first, then ISO 8601
 * @param {string} s - Date string to parse
 * @returns {Date|null} Parsed Date object or null if invalid
 */
const parseDateFlexibleUTC = (s) => {
  const d1 = parseYmdUtc(s);
  if (d1) return d1;
  if (!s) return null;
  const d2 = new Date(s);
  return Number.isNaN(d2.getTime()) ? null : d2;
};

/**
 * Build MongoDB date filter object for queries
 * @param {Date|null} parsedStartDate - Parsed start date
 * @param {Date|null} parsedEndDate - Parsed end date
 * @returns {Object} MongoDB date filter object
 */
const buildDateFilter = (parsedStartDate, parsedEndDate) => {
  const dateFilter = {};

  if (parsedStartDate && parsedEndDate) {
    // If both dates are provided, use them as range
    dateFilter.date = {
      $gte: parsedStartDate,
      $lte: parsedEndDate,
    };
  } else if (parsedStartDate) {
    // If only start date is provided, use it as lower bound
    dateFilter.date = { $gte: parsedStartDate };
  } else if (parsedEndDate) {
    // If only end date is provided, use it as upper bound
    dateFilter.date = { $lte: parsedEndDate };
  }
  // If no dates are provided, return empty filter

  return dateFilter;
};

const toolStoppageReasonController = function (ToolStoppageReason) {
  const cache = cacheClosure();

  /**
   * Get tool stoppage reason data for a specific project with optional date filtering
   * @route GET /api/bm/projects/:id/tools-stoppage-reason
   * @param {Object} req - Express request object
   * @param {string} req.params.id - Project ID (MongoDB ObjectId)
   * @param {string} [req.query.startDate] - Optional start date (YYYY-MM-DD or ISO 8601)
   * @param {string} [req.query.endDate] - Optional end date (YYYY-MM-DD or ISO 8601)
   * @param {Object} res - Express response object
   * @returns {Promise<Array>} Array of tool stoppage reason records sorted by date and toolName
   */
  const getToolsStoppageReason = async (req, res) => {
    const startTime = Date.now(); // Start timing the request

    try {
      const { id: projectId } = req.params;
      const { startDate, endDate } = req.query;

      // Validate project ID format
      if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({
          error: ERROR_MESSAGES.INVALID_PROJECT_ID_FORMAT(projectId),
        });
      }

      // Validate date formats
      const parsedStartDate = startDate ? parseDateFlexibleUTC(startDate) : null;
      const parsedEndDate = endDate ? parseDateFlexibleUTC(endDate) : null;

      if (startDate && !parsedStartDate) {
        return res.status(400).json({
          error: ERROR_MESSAGES.INVALID_START_DATE(startDate),
        });
      }

      if (endDate && !parsedEndDate) {
        return res.status(400).json({
          error: ERROR_MESSAGES.INVALID_END_DATE(endDate),
        });
      }

      // Validate date range logic
      if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
        return res.status(400).json({
          error: ERROR_MESSAGES.INVALID_DATE_RANGE,
        });
      }

      // Validate project existence
      const projectExists = await BuildingProject.exists({ _id: projectId });
      if (!projectExists) {
        return res.status(404).json({
          error: ERROR_MESSAGES.PROJECT_NOT_FOUND(projectId),
        });
      }

      // Build date filter based on what's provided
      const dateFilter = buildDateFilter(parsedStartDate, parsedEndDate);

      // Query the database for tool stoppage reason data
      const results = await ToolStoppageReason.aggregate([
        {
          $match: {
            projectId: new ObjectId(projectId),
            ...dateFilter,
          },
        },
        {
          $sort: {
            date: 1, // Sort by date ascending (oldest first)
            toolName: 1, // Then by toolName alphabetically
          },
        },
      ]);

      // Calculate execution time
      const executionTimeMs = Date.now() - startTime;

      // Log query performance for monitoring
      if (executionTimeMs > 1000) {
        Logger.logInfo(`Slow query detected in getToolsStoppageReason: ${executionTimeMs}ms`, {
          projectId,
          startDate,
          endDate,
          executionTimeMs,
        });
      }

      // Return structured response with metadata
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
      const executionTimeMs = Date.now() - startTime;
      const transactionName =
        'GET /api/bm/projects/:id/tools-stoppage-reason - getToolsStoppageReason';
      const requestContext = {
        projectId,
        startDate,
        endDate,
        url: req.originalUrl,
        method: req.method,
        executionTimeMs,
        errorType: error.name,
      };

      Logger.logException(error, transactionName, requestContext);

      // Check if it's a MongoDB connection error
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
        error: ERROR_MESSAGES.DATABASE_QUERY_FAILED_DATA,
        executionTimeMs,
      });
    }
  };

  /**
   * Get list of unique project IDs that have tool stoppage reason data
   * @route GET /api/bm/tools-stoppage-reason/projects
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Array>} Array of objects with projectId and projectName, cached for 5 minutes
   */
  const getUniqueProjectIds = async (req, res) => {
    const startTime = Date.now(); // Start timing the request

    try {
      // Define cache key for project list
      const cacheKey = CACHE_KEYS.PROJECT_LIST;

      // Check if cached data exists (TTL: 300s / 5 minutes)
      const cachedData = cache.getCache(cacheKey);
      if (cache.hasCache(cacheKey) && cachedData) {
        // Add execution time for cache hit
        const executionTimeMs = Date.now() - startTime;
        return res.json({
          ...cachedData,
          executionTimeMs,
          cached: true,
        });
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

      // Format the response
      const formattedResults = results.map((item) => ({
        projectId: item._id,
        projectName: item.projectName || 'Unknown Project',
      }));

      // Calculate execution time
      const executionTimeMs = Date.now() - startTime;

      // Log query performance for monitoring
      if (executionTimeMs > 1000) {
        Logger.logInfo(`Slow query detected in getUniqueProjectIds: ${executionTimeMs}ms`, {
          executionTimeMs,
        });
      }

      // Create structured response
      const response = {
        success: true,
        data: formattedResults,
        count: formattedResults.length,
        message: formattedResults.length === 0 ? 'No projects with tool stoppage data found' : null,
        executionTimeMs,
        cached: false,
      };

      // Cache the response for 5 minutes (default TTL: 300s)
      cache.setCache(cacheKey, response);

      return res.json(response);
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const transactionName = 'GET /api/bm/tools-stoppage-reason/projects - getUniqueProjectIds';
      const requestContext = {
        url: req.originalUrl,
        method: req.method,
        executionTimeMs,
        errorType: error.name,
      };

      Logger.logException(error, transactionName, requestContext);

      // Check if it's a MongoDB connection error
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
        error: ERROR_MESSAGES.DATABASE_QUERY_FAILED_PROJECTS,
        executionTimeMs,
      });
    }
  };

  return {
    getToolsStoppageReason,
    getUniqueProjectIds,
  };
};

module.exports = toolStoppageReasonController;
