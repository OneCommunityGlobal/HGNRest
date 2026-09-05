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
const DATE_ACCEPTED_FORMATS = [
  'YYYY-MM-DD',
  'MM-DD-YYYY',
  'MM/DD/YYYY',
  'ISO 8601 strings',
  'Date objects',
];

function throwDateParseError(message, originalInput) {
  const error = new Error(message);
  error.type = 'DATE_PARSE_ERROR';
  error.originalInput = originalInput;
  error.acceptedFormats = DATE_ACCEPTED_FORMATS;
  throw error;
}

/** Try to parse a YYYY-MM-DD formatted string via Date.parse; returns a valid Date or null. */
function tryParseIsoFormat(isoFormat) {
  const parsed = Date.parse(isoFormat);
  if (Number.isNaN(parsed)) return null;
  const date = new Date(parsed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Try matching and parsing a delimited date string (MM-DD-YYYY or MM/DD/YYYY); returns a Date or null. */
function tryParseDelimitedDate(trimmedInput, delimiterRegex) {
  const match = delimiterRegex.exec(trimmedInput);
  if (!match) return null;
  const [, month, day, year] = match;
  const isoFormat = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return tryParseIsoFormat(isoFormat);
}

function parseDateInput(dateInput) {
  // Handle Date objects (pass through if valid)
  if (dateInput instanceof Date) {
    if (!Number.isNaN(dateInput.getTime())) {
      return dateInput;
    }
    throwDateParseError('Invalid Date object provided.', dateInput);
  }

  // Handle non-string inputs
  if (typeof dateInput !== 'string') {
    throwDateParseError(
      `Invalid date input type. Expected string or Date object, got ${typeof dateInput}.`,
      dateInput,
    );
  }

  // Handle empty strings
  const trimmedInput = dateInput.trim();
  if (trimmedInput === '') {
    throwDateParseError('Empty date string provided.', dateInput);
  }

  // Try native Date.parse() first (handles ISO strings well)
  const isoDate = tryParseIsoFormat(trimmedInput);
  if (isoDate) return isoDate;

  // Try MM-DD-YYYY format (with dashes)
  const dashDate = tryParseDelimitedDate(trimmedInput, /^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashDate) return dashDate;

  // Try MM/DD/YYYY format (with slashes)
  const slashDate = tryParseDelimitedDate(trimmedInput, /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) return slashDate;

  // All parsing attempts failed
  return throwDateParseError(
    `Invalid date format: "${dateInput}". Accepted formats: YYYY-MM-DD, MM-DD-YYYY, MM/DD/YYYY, or ISO 8601 strings.`,
    dateInput,
  );
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
function reThrowWithParameterContext(error, parameterName) {
  if (error.type === 'DATE_PARSE_ERROR') {
    const contextualError = new Error(`Invalid ${parameterName}: ${error.message}`);
    contextualError.type = 'DATE_PARSE_ERROR';
    contextualError.originalInput = error.originalInput;
    contextualError.acceptedFormats = error.acceptedFormats;
    contextualError.parameter = parameterName;
    throw contextualError;
  }
  throw error;
}

function resolveEffectiveStartDate(startDateInput, defaultStartDate) {
  const hasInput =
    startDateInput !== undefined && startDateInput !== null && String(startDateInput).trim() !== '';

  if (hasInput) {
    try {
      const parsedStart = parseDateInput(startDateInput);
      return { effectiveStart: normalizeStartDate(parsedStart, true), defaultApplied: false };
    } catch (error) {
      reThrowWithParameterContext(error, 'startDate');
    }
  }

  if (defaultStartDate !== undefined && defaultStartDate !== null) {
    if (!(defaultStartDate instanceof Date) || Number.isNaN(defaultStartDate.getTime())) {
      throwDateParseError('defaultStartDate must be a valid Date object', defaultStartDate);
    }
    return { effectiveStart: normalizeStartDate(defaultStartDate, true), defaultApplied: true };
  }

  throwDateParseError(
    'startDate is required but was not provided and no defaultStartDate was given.',
    startDateInput,
  );
  return undefined;
}

function resolveEffectiveEndDate(endDateInput, defaultEndDate) {
  const hasInput =
    endDateInput !== undefined && endDateInput !== null && String(endDateInput).trim() !== '';

  if (hasInput) {
    try {
      const parsedEnd = parseDateInput(endDateInput);
      return {
        effectiveEnd: normalizeEndDate(parsedEnd, true),
        defaultApplied: false,
        cappedToNow: isDateToday(parsedEnd, true),
      };
    } catch (error) {
      reThrowWithParameterContext(error, 'endDate');
    }
  }

  if (defaultEndDate !== undefined && defaultEndDate !== null) {
    if (!(defaultEndDate instanceof Date) || Number.isNaN(defaultEndDate.getTime())) {
      throwDateParseError('defaultEndDate must be a valid Date object', defaultEndDate);
    }
    return {
      effectiveEnd: normalizeEndDate(defaultEndDate, true),
      defaultApplied: true,
      cappedToNow: isDateToday(defaultEndDate, true),
    };
  }

  const now = new Date();
  return { effectiveEnd: normalizeEndDate(now, true), defaultApplied: true, cappedToNow: true };
}

function parseAndNormalizeDateRangeUTC(
  startDateInput,
  endDateInput,
  defaultStartDate,
  defaultEndDate,
) {
  const { effectiveStart, defaultApplied: startDefaultApplied } = resolveEffectiveStartDate(
    startDateInput,
    defaultStartDate,
  );
  const {
    effectiveEnd,
    defaultApplied: endDefaultApplied,
    cappedToNow: endCappedToNowMinus5Min,
  } = resolveEffectiveEndDate(endDateInput, defaultEndDate);

  // Validation: ensure start <= end
  if (effectiveStart.getTime() > effectiveEnd.getTime()) {
    const error = new Error(
      `Invalid date range: startDate (${effectiveStart.toISOString()}) must be less than or equal to endDate (${effectiveEnd.toISOString()}).`,
    );
    error.type = 'DATE_RANGE_ERROR';
    error.effectiveStart = effectiveStart.toISOString();
    error.effectiveEnd = effectiveEnd.toISOString();
    throw error;
  }

  // Return structured result
  return {
    effectiveStart,
    effectiveEnd,
    defaultsApplied: {
      startDate: startDefaultApplied,
      endDate: endDefaultApplied,
    },
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
