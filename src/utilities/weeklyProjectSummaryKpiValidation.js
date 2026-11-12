const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID_FORMAT = /^[0-9a-fA-F]{24}$/;
const TREND_DAYS = ['7', '30', '90'];
const DATE_LENGTH = 10;
const OBJECT_ID_LENGTH = 24;
const MONTHS_IN_YEAR = 12;
const LEAP_YEAR_DIVISOR = 4;
const CENTURY_DIVISOR = 100;
const LEAP_CENTURY_DIVISOR = 400;
const LONG_MONTH = 31;
const SHORT_MONTH = 30;
const FEBRUARY = 28;
const LEAP_FEBRUARY = 29;

function isValidDateString(value) {
  if (typeof value !== 'string' || value.length !== DATE_LENGTH || !DATE_FORMAT.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const isLeapYear =
    year % LEAP_YEAR_DIVISOR === 0 &&
    (year % CENTURY_DIVISOR !== 0 || year % LEAP_CENTURY_DIVISOR === 0);
  const daysInMonth = [
    LONG_MONTH,
    isLeapYear ? LEAP_FEBRUARY : FEBRUARY,
    LONG_MONTH,
    SHORT_MONTH,
    LONG_MONTH,
    SHORT_MONTH,
    LONG_MONTH,
    LONG_MONTH,
    SHORT_MONTH,
    LONG_MONTH,
    SHORT_MONTH,
    LONG_MONTH,
  ];
  return month >= 1 && month <= MONTHS_IN_YEAR && day >= 1 && day <= daysInMonth[month - 1];
}

function validateField(value, label, isValid, invalidMessage) {
  if (value === undefined || value === null || value === '') return `${label} is required`;
  if (!isValid(value)) return invalidMessage;
  return null;
}

function isValidProjectId(value) {
  return (
    typeof value === 'string' &&
    (value === 'all' || (value.length === OBJECT_ID_LENGTH && OBJECT_ID_FORMAT.test(value)))
  );
}

function validateKpiQuery(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return 'query must be an object';
  }

  const { startDate, endDate, trendDays, projectId } = query;
  const startError = validateField(
    startDate,
    'startDate',
    isValidDateString,
    'startDate must be a valid YYYY-MM-DD date',
  );
  if (startError) return startError;
  const endError = validateField(
    endDate,
    'endDate',
    isValidDateString,
    'endDate must be a valid YYYY-MM-DD date',
  );
  if (endError) return endError;
  if (startDate > endDate) return 'startDate must be before or equal to endDate';

  const trendError = validateField(
    trendDays,
    'trendDays',
    (value) => typeof value === 'string' && TREND_DAYS.includes(value),
    'trendDays must be 7, 30, or 90',
  );
  if (trendError) return trendError;
  return validateField(
    projectId,
    'projectId',
    isValidProjectId,
    'projectId must be a 24-character hexadecimal ObjectId or "all"',
  );
}

module.exports = { validateKpiQuery };
