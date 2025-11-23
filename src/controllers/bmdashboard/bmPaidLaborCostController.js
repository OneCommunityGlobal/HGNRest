const LaborCost = require('../../models/laborCost');
const logger = require('../../startup/logger');

/**
 * Helper function to check if a string looks like a JSON object or array
 * Used to detect invalid mixed formats (e.g., {"key":"val"},Project 1)
 */
const looksLikeJson = (str) => {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
};

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
      // If parsed successfully, check if it's an object (not array) and not null
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        // Single JSON object when expecting array - this is invalid
        return {
          __invalidFormat: true,
          __error:
            'Invalid format: JSON object provided instead of array. Use JSON array format (e.g., ["Project 1"]) or comma-separated strings.',
        };
      }
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // If not JSON, treat as comma-separated string
      const commaSeparated = param
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      // Check if any item looks like JSON (invalid mixed format)
      const hasJsonLike = commaSeparated.some((item) => looksLikeJson(item));
      if (hasJsonLike) {
        return {
          __invalidFormat: true,
          __error:
            'Invalid format: Cannot mix JSON objects/arrays with plain strings. Use JSON array (e.g., ["Project 1"]) or comma-separated strings (e.g., Project 1,Project 2).',
        };
      }

      return commaSeparated;
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
 * Handles edge cases like invalid months (e.g., "2025-13-01"), invalid days, dates far in past/future
 */
const isValidDateValue = (dateString) => {
  if (!dateString) return true; // null/undefined is valid (optional)
  if (typeof dateString !== 'string') return false;

  // Parse the date
  const date = new Date(dateString);

  // Check if date is valid (not NaN)
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  // For date-only format (YYYY-MM-DD), verify components match to catch invalid months/days
  // This catches edge cases like "2025-13-01" (invalid month) which JavaScript adjusts
  // Note: Date-only strings are parsed as UTC midnight, so use UTC methods for comparison
  if (!dateString.includes('T') && !dateString.includes('Z')) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      // Check if parsed values match input (catches invalid months/days that get adjusted)
      // Use UTC methods since date-only strings are parsed as UTC midnight
      if (
        !Number.isNaN(year) &&
        !Number.isNaN(month) &&
        !Number.isNaN(day) &&
        (date.getUTCFullYear() !== year ||
          date.getUTCMonth() + 1 !== month ||
          date.getUTCDate() !== day)
      ) {
        return false; // Date was adjusted (e.g., invalid month/day like "2025-13-01")
      }
    }
  }

  return true;
};

const laborCostController = () => {
  const getLaborCost = async (req, res) => {
    try {
      // Handle edge case: request query is missing or null
      // Default to empty object to allow optional parameters
      const query = req.query || {};

      // Extract parameters from req.query
      // Handle edge case: optional parameters default to "all values" behavior
      const { projects, tasks, date_range: dateRangeParam } = query;

      // Parse and validate projects array
      let projectsArray = [];
      if (projects !== undefined) {
        projectsArray = parseArrayParam(projects);

        // Check if parsing returned an invalid format marker
        if (projectsArray && typeof projectsArray === 'object' && projectsArray.__invalidFormat) {
          return res.status(400).json({
            Code: 'INVALID_PARAMETER',
            error: projectsArray.__error || 'projects parameter contains invalid format',
          });
        }

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

        // Check if parsing returned an invalid format marker
        if (tasksArray && typeof tasksArray === 'object' && tasksArray.__invalidFormat) {
          return res.status(400).json({
            Code: 'INVALID_PARAMETER',
            error: tasksArray.__error || 'tasks parameter contains invalid format',
          });
        }

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
          // Track if the param was a string before parsing (to detect parsing failures)
          const wasString = typeof dateRangeParam === 'string';
          dateRange = parseDateRangeParam(dateRangeParam);

          // If dateRangeParam was a non-empty string but parsing returned null,
          // that means JSON parsing failed (invalid JSON format)
          if (
            wasString &&
            dateRangeParam !== 'null' &&
            dateRangeParam.trim() !== '' &&
            dateRange === null
          ) {
            return res.status(400).json({
              Code: 'INVALID_PARAMETER',
              error:
                'date_range must be a valid JSON object (e.g., {"start_date":"2025-04-01","end_date":"2025-04-30"}) or null',
            });
          }

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

        // Validate that dates are strings if provided (not numbers or other types)
        if (startDate !== null && typeof startDate !== 'string') {
          return res.status(422).json({
            Code: 'INVALID_DATE_FORMAT',
            error:
              'start_date must be a string in ISO 8601 format (e.g., "2025-04-01" or "2025-04-01T00:00:00Z")',
          });
        }

        if (endDate !== null && typeof endDate !== 'string') {
          return res.status(422).json({
            Code: 'INVALID_DATE_FORMAT',
            error:
              'end_date must be a string in ISO 8601 format (e.g., "2025-04-30" or "2025-04-30T23:59:59Z")',
          });
        }
      }

      // Validate date formats
      // Handle edge cases: invalid months (e.g., "2025-13-01"), invalid days, dates far in past/future
      if (startDate !== null) {
        if (!isValidDateValue(startDate)) {
          return res.status(422).json({
            Code: 'INVALID_DATE_FORMAT',
            error:
              'start_date must be a valid ISO 8601 date string (e.g., "2025-04-01" or "2025-04-01T00:00:00Z")',
          });
        }
      }

      if (endDate !== null) {
        if (!isValidDateValue(endDate)) {
          return res.status(422).json({
            Code: 'INVALID_DATE_FORMAT',
            error:
              'end_date must be a valid ISO 8601 date string (e.g., "2025-04-30" or "2025-04-30T23:59:59Z")',
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
      // Handle edge cases: partial date ranges (only start_date or only end_date), null dates, null date_range
      if (dateRange !== null) {
        // date_range exists, check which dates are provided
        // Support open-ended date ranges: only start_date (filter from start to end of data)
        // or only end_date (filter from beginning of data to end)
        if (startDate !== null || endDate !== null) {
          queryFilter.date = {};
          if (startDate !== null) {
            // Convert to Date object and set to start of day for inclusive filtering
            // Use UTC methods to ensure consistent timezone handling
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);
            queryFilter.date.$gte = start;
          }
          if (endDate !== null) {
            // Convert to Date object and set to end of day for inclusive filtering
            // Use UTC methods to ensure consistent timezone handling
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
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
      // Handle edge case: empty results (no records match filters)
      // This is a valid case, not an error - return totalCost: 0, data: []
      const totalCost =
        formattedData.length > 0
          ? formattedData.reduce((sum, record) => sum + (record.cost || 0), 0)
          : 0;

      // Construct response object
      // Edge case: If no records match filters, return: { totalCost: 0, data: [] }
      // This handles cases like dates far in past/future with no records
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
