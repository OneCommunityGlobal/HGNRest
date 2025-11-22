const LaborCost = require('../../models/laborCost');
const logger = require('../../startup/logger');

/**
 * Helper function to parse array from query parameter
 * Handles JSON strings, comma-separated strings, or already parsed arrays
 */
const parseArrayParam = (param) => {
  if (!param) return [];
  if (Array.isArray(param)) return param;
  if (typeof param === 'string') {
    try {
      const parsed = JSON.parse(param);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // If not JSON, treat as comma-separated string
      return param
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
};

/**
 * Helper function to parse date_range object from query parameter
 * Handles JSON strings or already parsed objects
 */
const parseDateRangeParam = (param) => {
  if (!param) return null;
  if (typeof param === 'object' && param !== null) return param;
  if (typeof param === 'string') {
    try {
      return JSON.parse(param);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Validate ISO 8601 date format and value (not NaN when parsed)
 */
const isValidDateValue = (dateString) => {
  if (!dateString) return true; // null/undefined is valid (optional)
  if (typeof dateString !== 'string') return false;
  const date = new Date(dateString);
  return !Number.isNaN(date.getTime());
};

const laborCostController = () => {
  const getLaborCost = async (req, res) => {
    try {
      // Extract parameters from req.query
      const { projects, tasks, date_range: dateRangeParam } = req.query || {};

      // Parse and validate projects array
      let projectsArray = [];
      if (projects !== undefined) {
        projectsArray = parseArrayParam(projects);
        if (!Array.isArray(projectsArray)) {
          return res.status(400).json({
            Code: 'INVALID_PARAMETER',
            error: 'projects must be an array',
          });
        }
        // Validate that all project names are strings
        if (projectsArray.length > 0 && !projectsArray.every((p) => typeof p === 'string')) {
          return res.status(400).json({
            Code: 'INVALID_PARAMETER',
            error: 'All project names must be strings',
          });
        }
      }

      // Parse and validate tasks array
      let tasksArray = [];
      if (tasks !== undefined) {
        tasksArray = parseArrayParam(tasks);
        if (!Array.isArray(tasksArray)) {
          return res.status(400).json({
            Code: 'INVALID_PARAMETER',
            error: 'tasks must be an array',
          });
        }
        // Validate that all task names are strings
        if (tasksArray.length > 0 && !tasksArray.every((t) => typeof t === 'string')) {
          return res.status(400).json({
            Code: 'INVALID_PARAMETER',
            error: 'All task names must be strings',
          });
        }
      }

      // Parse and validate date_range object
      let dateRange = null;
      if (dateRangeParam !== undefined) {
        if (dateRangeParam === null) {
          dateRange = null;
        } else {
          dateRange = parseDateRangeParam(dateRangeParam);
          if (dateRange !== null && typeof dateRange !== 'object') {
            return res.status(400).json({
              Code: 'INVALID_PARAMETER',
              error: 'date_range must be an object or null',
            });
          }
        }
      }

      // Extract start_date and end_date from date_range
      let startDate = null;
      let endDate = null;
      if (dateRange !== null && typeof dateRange === 'object') {
        startDate = dateRange.start_date !== undefined ? dateRange.start_date : null;
        endDate = dateRange.end_date !== undefined ? dateRange.end_date : null;
      }

      // Validate date formats
      if (startDate !== null) {
        if (!isValidDateValue(startDate)) {
          return res.status(422).json({
            Code: 'INVALID_DATE_FORMAT',
            error: 'start_date must be a valid ISO 8601 date string',
          });
        }
      }

      if (endDate !== null) {
        if (!isValidDateValue(endDate)) {
          return res.status(422).json({
            Code: 'INVALID_DATE_FORMAT',
            error: 'end_date must be a valid ISO 8601 date string',
          });
        }
      }

      // Validate date range logic
      if (startDate !== null && endDate !== null) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
          return res.status(400).json({
            Code: 'INVALID_DATE_RANGE',
            error: 'start_date must be before or equal to end_date',
          });
        }
      }

      // Build MongoDB query filters
      const queryFilter = {};

      // Build date filter
      if (dateRange !== null) {
        // date_range exists, check which dates are provided
        if (startDate !== null || endDate !== null) {
          queryFilter.date = {};
          if (startDate !== null) {
            // Convert to Date object and set to start of day for inclusive filtering
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            queryFilter.date.$gte = start;
          }
          if (endDate !== null) {
            // Convert to Date object and set to end of day for inclusive filtering
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            queryFilter.date.$lte = end;
          }
        }
        // If neither date is provided but date_range exists, don't add date filter
      }
      // If date_range is null, don't add date filter (return all dates)

      // Build project filter
      if (projectsArray.length > 0) {
        queryFilter.project_name = { $in: projectsArray };
      }
      // If projectsArray is empty, don't add project filter (return all projects)

      // Build task filter
      if (tasksArray.length > 0) {
        queryFilter.task = { $in: tasksArray };
      }
      // If tasksArray is empty, don't add task filter (return all tasks)

      // Query database and retrieve records
      const laborCostRecords = await LaborCost.find(queryFilter)
        .sort({ date: 1 }) // Sort by date in chronological order
        .lean() // Return plain JavaScript objects for better performance
        .exec();

      // Format response data
      // Map database fields to response fields and format dates
      const formattedData = laborCostRecords.map((record) => ({
        project: record.project_name,
        task: record.task,
        date: record.date ? new Date(record.date).toISOString() : null,
        cost: typeof record.cost === 'number' ? record.cost : Number(record.cost),
      }));

      // Calculate total cost
      const totalCost =
        formattedData.length > 0
          ? formattedData.reduce((sum, record) => sum + (record.cost || 0), 0)
          : 0;

      // Construct response object
      // If no records match filters, return: { totalCost: 0, data: [] }
      const response = {
        totalCost,
        data: formattedData,
      };

      // Return response with 200 OK status code
      return res.status(200).json(response);
    } catch (error) {
      // Prepare error context for logging
      const errorContext = {
        query: req.query,
        method: req.method,
        url: req.originalUrl || req.url,
      };

      // Check if error is a MongoDB/database error
      const isDatabaseError =
        error.name === 'MongoError' ||
        error.name === 'MongooseError' ||
        error.name === 'CastError' ||
        error.name === 'ValidationError' ||
        (error.message && error.message.includes('Mongo')) ||
        (error.message && error.message.includes('connection'));

      // Log error with context
      if (isDatabaseError) {
        logger.logException(
          error,
          'getLaborCost - Database Error - Paid Labor Cost Controller',
          errorContext,
        );
        return res.status(500).json({
          Code: 'DATABASE_ERROR',
          error:
            'A database error occurred while fetching labor cost data. Please try again later.',
        });
      }

      // Handle unexpected errors
      logger.logException(
        error,
        'getLaborCost - Unexpected Error - Paid Labor Cost Controller',
        errorContext,
      );
      return res.status(500).json({
        Code: 'INTERNAL_SERVER_ERROR',
        error:
          'An unexpected error occurred while fetching labor cost data. Please try again later.',
      });
    }
  };

  return {
    getLaborCost,
  };
};

module.exports = laborCostController;
