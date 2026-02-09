/**
 * Date Parsing and Normalization Utilities for Material Cost Correlation
 *
 * Provides comprehensive date parsing (multiple formats), UTC normalization,
 * and date range computation. All date operations use UTC timezone.
 */

// Constants for date normalization
const SECONDS_IN_MINUTE = 60;
const MILLISECONDS_IN_SECOND = 1000;
const MINUTES_IN_MILLISECONDS = SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND;
const MINUTES_TO_SUBTRACT = 5;
const FIVE_MINUTES_IN_MILLISECONDS = MINUTES_TO_SUBTRACT * MINUTES_IN_MILLISECONDS;
const END_OF_DAY_HOUR = 23;
const END_OF_DAY_MINUTE = 59;
const END_OF_DAY_SECOND = 59;
const END_OF_DAY_MILLISECOND = 999;

/**
 * Parse various date input formats into a JavaScript Date object.
 * Handles ISO strings, American formats (MM-DD-YYYY, MM/DD/YYYY), and Date objects.
 *
 * @param {string|Date} dateInput - Date input in various formats
 * @returns {Date} Parsed Date object
 * @throws {Object} Structured error object with type 'DATE_PARSE_ERROR'
 */
function parseDateInput(dateInput) {
  // Handle Date objects (pass through if valid)
  if (dateInput instanceof Date) {
    if (!Number.isNaN(dateInput.getTime())) {
      return dateInput;
    }
    // Invalid Date object
    const error = {
      type: 'DATE_PARSE_ERROR',
      message: `Invalid Date object provided.`,
      originalInput: dateInput,
      acceptedFormats: [
        'YYYY-MM-DD',
        'MM-DD-YYYY',
        'MM/DD/YYYY',
        'ISO 8601 strings',
        'Date objects',
      ],
    };
    throw error;
  }

  // Handle non-string inputs
  if (typeof dateInput !== 'string') {
    const error = {
      type: 'DATE_PARSE_ERROR',
      message: `Invalid date input type. Expected string or Date object, got ${typeof dateInput}.`,
      originalInput: dateInput,
      acceptedFormats: [
        'YYYY-MM-DD',
        'MM-DD-YYYY',
        'MM/DD/YYYY',
        'ISO 8601 strings',
        'Date objects',
      ],
    };
    throw error;
  }

  // Handle empty strings
  const trimmedInput = dateInput.trim();
  if (trimmedInput === '') {
    const error = {
      type: 'DATE_PARSE_ERROR',
      message: 'Empty date string provided.',
      originalInput: dateInput,
      acceptedFormats: [
        'YYYY-MM-DD',
        'MM-DD-YYYY',
        'MM/DD/YYYY',
        'ISO 8601 strings',
        'Date objects',
      ],
    };
    throw error;
  }

  // Try native Date.parse() first (handles ISO strings well)
  const isoParsed = Date.parse(trimmedInput);
  if (!Number.isNaN(isoParsed)) {
    const date = new Date(isoParsed);
    // Validate the parsed date is actually valid
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // Try MM-DD-YYYY format (with dashes)
  const dashMatch = trimmedInput.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, month, day, year] = dashMatch;
    // Rearrange to ISO format YYYY-MM-DD
    const isoFormat = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const parsed = Date.parse(isoFormat);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Try MM/DD/YYYY format (with slashes)
  const slashMatch = trimmedInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    // Rearrange to ISO format YYYY-MM-DD
    const isoFormat = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const parsed = Date.parse(isoFormat);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // All parsing attempts failed
  const error = {
    type: 'DATE_PARSE_ERROR',
    message: `Invalid date format: "${dateInput}". Accepted formats: YYYY-MM-DD, MM-DD-YYYY, MM/DD/YYYY, or ISO 8601 strings.`,
    originalInput: dateInput,
    acceptedFormats: ['YYYY-MM-DD', 'MM-DD-YYYY', 'MM/DD/YYYY', 'ISO 8601 strings', 'Date objects'],
  };
  throw error;
}

/**
 * Normalize a start date to beginning of day in UTC.
 *
 * @param {Date} date - Date object to normalize
 * @param {boolean} isUTC - Whether to use UTC (default: true)
 * @returns {Date} Normalized Date object representing 00:00:00.000Z
 */
function normalizeStartDate(date, isUTC = true) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    const error = {
      type: 'DATE_PARSE_ERROR',
      message: 'normalizeStartDate requires a valid Date object',
    };
    throw error;
  }

  if (isUTC) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    // Date.UTC returns milliseconds, create Date from it
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  // Non-UTC normalization (for completeness, though we primarily use UTC)
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Check if a date (ignoring time) matches today's date in UTC.
 *
 * @param {Date} date - Date object to check
 * @param {boolean} isUTC - Whether to use UTC (default: true)
 * @returns {boolean} True if date matches today, false otherwise
 */
function isDateToday(date, isUTC = true) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  if (isUTC) {
    const inputYear = date.getUTCFullYear();
    const inputMonth = date.getUTCMonth();
    const inputDay = date.getUTCDate();

    const nowYear = now.getUTCFullYear();
    const nowMonth = now.getUTCMonth();
    const nowDay = now.getUTCDate();

    return inputYear === nowYear && inputMonth === nowMonth && inputDay === nowDay;
  }

  // Non-UTC comparison
  const inputYear = date.getFullYear();
  const inputMonth = date.getMonth();
  const inputDay = date.getDate();

  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const nowDay = now.getDate();

  return inputYear === nowYear && inputMonth === nowMonth && inputDay === nowDay;
}

/**
 * Normalize an end date to end of day in UTC, with special handling for "today".
 * If the date is today, returns current time minus 5 minutes.
 * Otherwise, returns end of day (23:59:59.999Z).
 *
 * @param {Date} date - Date object to normalize
 * @param {boolean} isUTC - Whether to use UTC (default: true)
 * @returns {Date} Normalized Date object
 */
function normalizeEndDate(date, isUTC = true) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    const error = {
      type: 'DATE_PARSE_ERROR',
      message: 'normalizeEndDate requires a valid Date object',
    };
    throw error;
  }

  // Check if date is today
  if (isDateToday(date, isUTC)) {
    // Return current UTC time minus 5 minutes
    const nowMinus5Min = Date.now() - FIVE_MINUTES_IN_MILLISECONDS;
    return new Date(nowMinus5Min);
  }

  // Not today - normalize to end of day
  if (isUTC) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    // Date.UTC returns milliseconds, create Date from it
    return new Date(
      Date.UTC(
        year,
        month,
        day,
        END_OF_DAY_HOUR,
        END_OF_DAY_MINUTE,
        END_OF_DAY_SECOND,
        END_OF_DAY_MILLISECOND,
      ),
    );
  }

  // Non-UTC normalization (for completeness)
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  return new Date(
    year,
    month,
    day,
    END_OF_DAY_HOUR,
    END_OF_DAY_MINUTE,
    END_OF_DAY_SECOND,
    END_OF_DAY_MILLISECOND,
  );
}

/**
 * Parse and normalize a date range in UTC with default handling.
 * This is the main function that orchestrates date range parsing and normalization.
 *
 * @param {string|Date|undefined} startDateInput - Optional start date input
 * @param {string|Date|undefined} endDateInput - Optional end date input
 * @param {Date|undefined} defaultStartDate - Optional default start date
 * @param {Date|undefined} defaultEndDate - Optional default end date (typically undefined)
 * @returns {Object} Object containing effectiveStart, effectiveEnd, defaultsApplied, endCappedToNowMinus5Min, originalInputs
 * @throws {Object} Structured error objects with type 'DATE_PARSE_ERROR' or 'DATE_RANGE_ERROR'
 */
// eslint-disable-next-line complexity, max-lines-per-function
function parseAndNormalizeDateRangeUTC(
  startDateInput,
  endDateInput,
  defaultStartDate,
  defaultEndDate,
) {
  const defaultsApplied = {
    startDate: false,
    endDate: false,
  };

  let effectiveStart;
  let effectiveEnd;
  let endCappedToNowMinus5Min = false;

  // Handle startDate
  if (
    startDateInput !== undefined &&
    startDateInput !== null &&
    String(startDateInput).trim() !== ''
  ) {
    try {
      const parsedStart = parseDateInput(startDateInput);
      effectiveStart = normalizeStartDate(parsedStart, true);
      defaultsApplied.startDate = false;
    } catch (error) {
      // Re-throw with context about which parameter failed
      if (error.type === 'DATE_PARSE_ERROR') {
        const contextualError = {
          type: 'DATE_PARSE_ERROR',
          message: `Invalid startDate: ${error.message}`,
          originalInput: error.originalInput,
          acceptedFormats: error.acceptedFormats,
          parameter: 'startDate',
        };
        throw contextualError;
      }
      throw error;
    }
  } else if (defaultStartDate !== undefined && defaultStartDate !== null) {
    // startDateInput is missing, use default if provided
    if (!(defaultStartDate instanceof Date) || Number.isNaN(defaultStartDate.getTime())) {
      const error = {
        type: 'DATE_PARSE_ERROR',
        message: 'defaultStartDate must be a valid Date object',
      };
      throw error;
    }
    effectiveStart = normalizeStartDate(defaultStartDate, true);
    defaultsApplied.startDate = true;
  } else {
    // No default provided - this case should be handled by caller
    // For now, we'll throw an error indicating startDate is required
    // eslint-disable-next-line no-throw-literal
    throw {
      type: 'DATE_PARSE_ERROR',
      message: 'startDate is required but was not provided and no defaultStartDate was given.',
      originalInput: startDateInput,
      acceptedFormats: [
        'YYYY-MM-DD',
        'MM-DD-YYYY',
        'MM/DD/YYYY',
        'ISO 8601 strings',
        'Date objects',
      ],
      parameter: 'startDate',
    };
  }

  // Handle endDate
  if (endDateInput !== undefined && endDateInput !== null && String(endDateInput).trim() !== '') {
    try {
      const parsedEnd = parseDateInput(endDateInput);
      // Check if it's today before normalization (for endCappedToNowMinus5Min flag)
      endCappedToNowMinus5Min = isDateToday(parsedEnd, true);
      effectiveEnd = normalizeEndDate(parsedEnd, true);
      defaultsApplied.endDate = false;
    } catch (error) {
      // Re-throw with context about which parameter failed
      if (error.type === 'DATE_PARSE_ERROR') {
        const contextualError = {
          type: 'DATE_PARSE_ERROR',
          message: `Invalid endDate: ${error.message}`,
          originalInput: error.originalInput,
          acceptedFormats: error.acceptedFormats,
          parameter: 'endDate',
        };
        throw contextualError;
      }
      throw error;
    }
  } else if (defaultEndDate !== undefined && defaultEndDate !== null) {
    // endDateInput is missing, use default if provided
    if (!(defaultEndDate instanceof Date) || Number.isNaN(defaultEndDate.getTime())) {
      const error = {
        type: 'DATE_PARSE_ERROR',
        message: 'defaultEndDate must be a valid Date object',
      };
      throw error;
    }
    // Check if default is today
    endCappedToNowMinus5Min = isDateToday(defaultEndDate, true);
    effectiveEnd = normalizeEndDate(defaultEndDate, true);
    defaultsApplied.endDate = true;
  } else {
    // No default provided - use current date/time
    const now = new Date();
    endCappedToNowMinus5Min = true; // It's today, so will be capped
    effectiveEnd = normalizeEndDate(now, true);
    defaultsApplied.endDate = true;
  }

  // Validation: ensure start <= end
  if (effectiveStart.getTime() > effectiveEnd.getTime()) {
    const error = {
      type: 'DATE_RANGE_ERROR',
      message: `Invalid date range: startDate (${effectiveStart.toISOString()}) must be less than or equal to endDate (${effectiveEnd.toISOString()}).`,
      effectiveStart: effectiveStart.toISOString(),
      effectiveEnd: effectiveEnd.toISOString(),
    };
    throw error;
  }

  // Return structured result
  return {
    effectiveStart,
    effectiveEnd,
    defaultsApplied,
    endCappedToNowMinus5Min,
    originalInputs: {
      startDateInput,
      endDateInput,
    },
  };
}

module.exports = {
  parseDateInput,
  normalizeStartDate,
  normalizeEndDate,
  isDateToday,
  parseAndNormalizeDateRangeUTC,
};
