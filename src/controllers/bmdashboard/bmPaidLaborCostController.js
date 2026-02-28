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
  const DATE_PARTS_COUNT = 3;
  if (!dateString.includes('T') && !dateString.includes('Z')) {
    const parts = dateString.split('-');
    if (parts.length === DATE_PARTS_COUNT) {
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

/**
 * Validates and parses projects parameter
 * Returns { error: { status, response } } if validation fails, or { projectsArray } on success
 */
const validateAndParseProjects = (projects) => {
  if (projects === undefined) {
    return { projectsArray: [] };
  }

  const projectsArray = parseArrayParam(projects);

  // Check if parsing returned an invalid format marker
  if (projectsArray && typeof projectsArray === 'object' && projectsArray.__invalidFormat) {
    return {
      error: {
        status: 400,
        response: {
          Code: 'INVALID_PARAMETER',
          error: projectsArray.__error || 'projects parameter contains invalid format',
        },
      },
    };
  }

  if (!Array.isArray(projectsArray)) {
    return {
      error: {
        status: 400,
        response: {
          Code: 'INVALID_PARAMETER',
          error: 'projects must be an array',
        },
      },
    };
  }

  // Validate that all project names are strings
  if (projectsArray.length > 0 && !projectsArray.every((p) => typeof p === 'string')) {
    return {
      error: {
        status: 400,
        response: {
          Code: 'INVALID_PARAMETER',
          error: 'All project names must be strings',
        },
      },
    };
  }

  return { projectsArray };
};

/**
 * Validates and parses tasks parameter
 * Returns { error: { status, response } } if validation fails, or { tasksArray } on success
 */
const validateAndParseTasks = (tasks) => {
  if (tasks === undefined) {
    return { tasksArray: [] };
  }

  const tasksArray = parseArrayParam(tasks);

  // Check if parsing returned an invalid format marker
  if (tasksArray && typeof tasksArray === 'object' && tasksArray.__invalidFormat) {
    return {
      error: {
        status: 400,
        response: {
          Code: 'INVALID_PARAMETER',
          error: tasksArray.__error || 'tasks parameter contains invalid format',
        },
      },
    };
  }

  if (!Array.isArray(tasksArray)) {
    return {
      error: {
        status: 400,
        response: {
          Code: 'INVALID_PARAMETER',
          error: 'tasks must be an array',
        },
      },
    };
  }

  // Validate that all task names are strings
  if (tasksArray.length > 0 && !tasksArray.every((t) => typeof t === 'string')) {
    return {
      error: {
        status: 400,
        response: {
          Code: 'INVALID_PARAMETER',
          error: 'All task names must be strings',
        },
      },
    };
  }

  return { tasksArray };
};

/**
 * Validates date string format
 * Returns { error: { status, response } } if validation fails, or null on success
 */
const validateDateString = (dateValue, fieldName) => {
  if (dateValue === null) {
    return null;
  }

  if (typeof dateValue !== 'string') {
    return {
      error: {
        status: 422,
        response: {
          Code: 'INVALID_DATE_FORMAT',
          error: `${fieldName} must be a string in ISO 8601 format (e.g., "2025-04-01" or "2025-04-01T00:00:00Z")`,
        },
      },
    };
  }

  if (!isValidDateValue(dateValue)) {
    return {
      error: {
        status: 422,
        response: {
          Code: 'INVALID_DATE_FORMAT',
          error: `${fieldName} must be a valid ISO 8601 date string (e.g., "2025-04-01" or "2025-04-01T00:00:00Z")`,
        },
      },
    };
  }

  return null;
};

/**
 * Validates date range logic (start_date must be before or equal to end_date)
 * Returns { error: { status, response } } if validation fails, or null on success
 */
const validateDateRangeLogic = (startDate, endDate) => {
  if (startDate !== null && endDate !== null) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return {
        error: {
          status: 400,
          response: {
            Code: 'INVALID_DATE_RANGE',
            error: 'start_date must be before or equal to end_date',
          },
        },
      };
    }
  }
  return null;
};

/**
 * Parses date_range parameter structure
 * Returns { error: { status, response } } if parsing fails, or { dateRange, startDate, endDate } on success
 */
const parseDateRangeStructure = (dateRangeParam) => {
  if (dateRangeParam === undefined || dateRangeParam === null) {
    return { dateRange: null, startDate: null, endDate: null };
  }

  // Track if the param was a string before parsing (to detect parsing failures)
  const wasString = typeof dateRangeParam === 'string';
  const dateRange = parseDateRangeParam(dateRangeParam);

  // If dateRangeParam was a non-empty string but parsing returned null,
  // that means JSON parsing failed (invalid JSON format)
  if (
    wasString &&
    dateRangeParam !== 'null' &&
    dateRangeParam.trim() !== '' &&
    dateRange === null
  ) {
    return {
      error: {
        status: 400,
        response: {
          Code: 'INVALID_PARAMETER',
          error:
            'date_range must be a valid JSON object (e.g., {"start_date":"2025-04-01","end_date":"2025-04-30"}) or null',
        },
      },
    };
  }

  if (dateRange !== null && typeof dateRange !== 'object') {
    return {
      error: {
        status: 400,
        response: {
          Code: 'INVALID_PARAMETER',
          error: 'date_range must be an object or null',
        },
      },
    };
  }

  // Extract start_date and end_date from date_range
  let startDate = null;
  let endDate = null;
  if (dateRange !== null && typeof dateRange === 'object') {
    startDate = dateRange.start_date !== undefined ? dateRange.start_date : null;
    endDate = dateRange.end_date !== undefined ? dateRange.end_date : null;
  }

  return { dateRange, startDate, endDate };
};

/**
 * Validates and parses date_range parameter
 * Returns { error: { status, response } } if validation fails, or { dateRange, startDate, endDate } on success
 */
const validateAndParseDateRange = (dateRangeParam) => {
  // Parse date range structure
  const parseResult = parseDateRangeStructure(dateRangeParam);
  if (parseResult.error) {
    return parseResult;
  }

  const { dateRange, startDate, endDate } = parseResult;

  // Validate start_date format
  const startDateError = validateDateString(startDate, 'start_date');
  if (startDateError) {
    return startDateError;
  }

  // Validate end_date format
  const endDateError = validateDateString(endDate, 'end_date');
  if (endDateError) {
    return endDateError;
  }

  // Validate date range logic
  const rangeLogicError = validateDateRangeLogic(startDate, endDate);
  if (rangeLogicError) {
    return rangeLogicError;
  }

  return { dateRange, startDate, endDate };
};

// Constants for date manipulation
const START_OF_DAY_HOUR = 0;
const START_OF_DAY_MINUTE = 0;
const START_OF_DAY_SECOND = 0;
const START_OF_DAY_MS = 0;
const END_OF_DAY_HOUR = 23;
const END_OF_DAY_MINUTE = 59;
const END_OF_DAY_SECOND = 59;
const END_OF_DAY_MS = 999;

/**
 * Builds MongoDB query filter from parsed parameters
 */
const buildQueryFilter = ({ projectsArray, tasksArray, dateRange, startDate, endDate }) => {
  const queryFilter = {};

  // Build date filter
  if (dateRange !== null) {
    if (startDate !== null || endDate !== null) {
      queryFilter.date = {};
      if (startDate !== null) {
        const start = new Date(startDate);
        start.setUTCHours(
          START_OF_DAY_HOUR,
          START_OF_DAY_MINUTE,
          START_OF_DAY_SECOND,
          START_OF_DAY_MS,
        );
        queryFilter.date.$gte = start;
      }
      if (endDate !== null) {
        const end = new Date(endDate);
        end.setUTCHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MS);
        queryFilter.date.$lte = end;
      }
    }
  }

  // Build project filter
  if (projectsArray.length > 0) {
    queryFilter.project_name = { $in: projectsArray };
  }

  // Build task filter
  if (tasksArray.length > 0) {
    queryFilter.task = { $in: tasksArray };
  }

  return queryFilter;
};

/**
 * Fetches labor cost records from the database using a validated filter.
 * This function must only be called with validated/sanitized parameters (from
 * validateAndParseProjects, validateAndParseTasks, validateAndParseDateRange)
 * so that the query is not constructed from raw user-controlled data.
 *
 * @param {Object} validatedFilter - Validated filter parameters
 * @param {string[]} validatedFilter.projectsArray - Validated project names
 * @param {string[]} validatedFilter.tasksArray - Validated task names
 * @param {Object|null} validatedFilter.dateRange - Validated date range object
 * @param {string|null} validatedFilter.startDate - Validated start date string
 * @param {string|null} validatedFilter.endDate - Validated end date string
 * @returns {Promise<Object[]>} Labor cost records
 */
const findLaborCostByValidatedFilter = async ({
  projectsArray,
  tasksArray,
  dateRange,
  startDate,
  endDate,
}) => {
  const queryFilter = buildQueryFilter({
    projectsArray,
    tasksArray,
    dateRange,
    startDate,
    endDate,
  });
  return LaborCost.find(queryFilter).sort({ date: 1 }).lean().exec();
};

/**
 * Formats response data and calculates total cost
 */
const formatResponseData = (laborCostRecords) => {
  const formattedData = laborCostRecords.map((record) => ({
    project: record.project_name,
    task: record.task,
    date: record.date ? new Date(record.date).toISOString() : null,
    cost: typeof record.cost === 'number' ? record.cost : Number(record.cost),
  }));

  const totalCost =
    formattedData.length > 0
      ? formattedData.reduce((sum, record) => sum + (record.cost || 0), 0)
      : 0;

  return {
    totalCost,
    data: formattedData,
  };
};

/**
 * Handles errors and returns appropriate response
 */
const handleError = (error, req, res) => {
  const errorContext = {
    query: req.query,
    method: req.method,
    url: req.originalUrl || req.url,
  };

  const isDatabaseError =
    error.name === 'MongoError' ||
    error.name === 'MongooseError' ||
    error.name === 'CastError' ||
    error.name === 'ValidationError' ||
    (error.message && error.message.includes('Mongo')) ||
    (error.message && error.message.includes('connection'));

  if (isDatabaseError) {
    logger.logException(
      error,
      'getLaborCost - Database Error - Paid Labor Cost Controller',
      errorContext,
    );
    return res.status(500).json({
      Code: 'DATABASE_ERROR',
      error: 'A database error occurred while fetching labor cost data. Please try again later.',
    });
  }

  logger.logException(
    error,
    'getLaborCost - Unexpected Error - Paid Labor Cost Controller',
    errorContext,
  );
  return res.status(500).json({
    Code: 'INTERNAL_SERVER_ERROR',
    error: 'An unexpected error occurred while fetching labor cost data. Please try again later.',
  });
};

const laborCostController = () => {
  const getLaborCost = async (req, res) => {
    try {
      // Handle edge case: request query is missing or null
      const query = req.query || {};

      // Extract parameters from req.query
      const { projects, tasks, date_range: dateRangeParam } = query;

      // Validate and parse projects
      const projectsResult = validateAndParseProjects(projects);
      if (projectsResult.error) {
        return res.status(projectsResult.error.status).json(projectsResult.error.response);
      }
      const { projectsArray } = projectsResult;

      // Validate and parse tasks
      const tasksResult = validateAndParseTasks(tasks);
      if (tasksResult.error) {
        return res.status(tasksResult.error.status).json(tasksResult.error.response);
      }
      const { tasksArray } = tasksResult;

      // Validate and parse date_range
      const dateRangeResult = validateAndParseDateRange(dateRangeParam);
      if (dateRangeResult.error) {
        return res.status(dateRangeResult.error.status).json(dateRangeResult.error.response);
      }
      const { dateRange, startDate, endDate } = dateRangeResult;

      // Query database using validated parameters only (not raw req.query)
      const laborCostRecords = await findLaborCostByValidatedFilter({
        projectsArray,
        tasksArray,
        dateRange,
        startDate,
        endDate,
      });

      // Format response data
      const response = formatResponseData(laborCostRecords);

      // Return response with 200 OK status code
      return res.status(200).json(response);
    } catch (error) {
      return handleError(error, req, res);
    }
  };

  return {
    getLaborCost,
  };
};

module.exports = laborCostController;
module.exports.testExports = {
  looksLikeJson,
  parseArrayParam,
  parseDateRangeParam,
  isValidDateValue,
};
