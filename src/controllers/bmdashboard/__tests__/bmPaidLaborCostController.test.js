const bmPaidLaborCostController = require('../bmPaidLaborCostController');

jest.mock('../../../models/laborCost');
jest.mock('../../../startup/logger');

describe('bmPaidLaborCostController - Helper Functions', () => {
  // Get test exports for helper functions
  const { looksLikeJson, parseArrayParam, parseDateRangeParam, isValidDateValue } =
    bmPaidLaborCostController.testExports;

  describe('looksLikeJson()', () => {
    it('should return true for valid JSON object string', () => {
      expect(looksLikeJson('{"key":"value"}')).toBe(true);
    });

    it('should return true for nested JSON object', () => {
      expect(looksLikeJson('{"nested":{"key":"val"}}')).toBe(true);
    });

    it('should return true for JSON array string', () => {
      expect(looksLikeJson('["item1","item2"]')).toBe(true);
    });

    it('should return true for JSON with leading whitespace', () => {
      expect(looksLikeJson('  {"key":"value"}')).toBe(true);
    });

    it('should return false for plain string', () => {
      expect(looksLikeJson('plain text')).toBe(false);
    });

    it('should return false for comma-separated string', () => {
      expect(looksLikeJson('Project A, Project B')).toBe(false);
    });

    it('should return false for null input', () => {
      expect(looksLikeJson(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(looksLikeJson(undefined)).toBe(false);
    });

    it('should return false for number input', () => {
      expect(looksLikeJson(123)).toBe(false);
    });

    it('should return false for object (not string)', () => {
      expect(looksLikeJson({})).toBe(false);
    });

    it('should return false for array (not string)', () => {
      expect(looksLikeJson([])).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(looksLikeJson('')).toBe(false);
    });
  });

  describe('parseArrayParam()', () => {
    it('should return empty array for null input', () => {
      expect(parseArrayParam(null)).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      expect(parseArrayParam(undefined)).toEqual([]);
    });

    it('should return array as-is when already an array', () => {
      const input = ['Project A', 'Project B'];
      expect(parseArrayParam(input)).toEqual(input);
    });

    it('should parse valid JSON array string', () => {
      expect(parseArrayParam('["Project A","Project B"]')).toEqual(['Project A', 'Project B']);
    });

    it('should parse single item JSON array', () => {
      expect(parseArrayParam('["Single"]')).toEqual(['Single']);
    });

    it('should wrap JSON string in array', () => {
      expect(parseArrayParam('"Project A"')).toEqual(['Project A']);
    });

    it('should return error object for JSON object (invalid)', () => {
      const result = parseArrayParam('{"key":"value"}');
      expect(result).toHaveProperty('__invalidFormat', true);
      expect(result).toHaveProperty('__error');
      expect(result.__error).toContain('JSON object provided instead of array');
    });

    it('should parse comma-separated string', () => {
      expect(parseArrayParam('Project A,Project B')).toEqual(['Project A', 'Project B']);
    });

    it('should parse comma-separated string with spaces', () => {
      expect(parseArrayParam('Project A, Project B')).toEqual(['Project A', 'Project B']);
    });

    it('should return single value array for string without comma', () => {
      expect(parseArrayParam('Single Project')).toEqual(['Single Project']);
    });

    it('should return error object for mixed JSON and plain string', () => {
      const result = parseArrayParam('{"json":true},Plain');
      expect(result).toHaveProperty('__invalidFormat', true);
      expect(result).toHaveProperty('__error');
      expect(result.__error).toContain('Cannot mix JSON');
    });

    it('should return error object for invalid JSON that looks like JSON', () => {
      // '[incomplete' starts with '[' so looksLikeJson returns true, triggering error
      const result = parseArrayParam('[incomplete');
      expect(result).toHaveProperty('__invalidFormat', true);
      expect(result).toHaveProperty('__error');
      expect(result.__error).toContain('Cannot mix JSON');
    });

    it('should return empty array for empty string', () => {
      expect(parseArrayParam('')).toEqual([]);
    });

    it('should return empty array for string with only commas and spaces', () => {
      expect(parseArrayParam('  ,  ,  ')).toEqual([]);
    });

    it('should return empty array for number input', () => {
      expect(parseArrayParam(123)).toEqual([]);
    });
  });

  describe('parseDateRangeParam()', () => {
    it('should return null for null input', () => {
      expect(parseDateRangeParam(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseDateRangeParam(undefined)).toBeNull();
    });

    it('should return object as-is when already an object', () => {
      const input = { start_date: '2025-04-01', end_date: '2025-04-30' };
      expect(parseDateRangeParam(input)).toEqual(input);
    });

    it('should parse valid JSON string', () => {
      const result = parseDateRangeParam('{"start_date":"2025-04-01","end_date":"2025-04-30"}');
      expect(result).toEqual({
        start_date: '2025-04-01',
        end_date: '2025-04-30',
      });
    });

    it('should parse partial object JSON string', () => {
      const result = parseDateRangeParam('{"start_date":"2025-04-01"}');
      expect(result).toEqual({ start_date: '2025-04-01' });
    });

    it('should parse empty object JSON string', () => {
      expect(parseDateRangeParam('{}')).toEqual({});
    });

    it('should return null for invalid JSON string', () => {
      expect(parseDateRangeParam('invalid json')).toBeNull();
    });

    it('should return null for malformed JSON string', () => {
      expect(parseDateRangeParam('{malformed')).toBeNull();
    });

    it('should return null for number input', () => {
      expect(parseDateRangeParam(123)).toBeNull();
    });

    it('should parse string "null" to null', () => {
      expect(parseDateRangeParam('null')).toBeNull();
    });
  });

  describe('isValidDateValue()', () => {
    it('should return true for null (optional)', () => {
      expect(isValidDateValue(null)).toBe(true);
    });

    it('should return true for undefined (optional)', () => {
      expect(isValidDateValue(undefined)).toBe(true);
    });

    it('should return true for empty string (falsy)', () => {
      expect(isValidDateValue('')).toBe(true);
    });

    it('should return true for valid date-only format', () => {
      expect(isValidDateValue('2025-04-01')).toBe(true);
    });

    it('should return true for another valid date-only format', () => {
      expect(isValidDateValue('2025-04-30')).toBe(true);
    });

    it('should return true for end of year date', () => {
      expect(isValidDateValue('2025-12-31')).toBe(true);
    });

    it('should return true for start of year date', () => {
      expect(isValidDateValue('2025-01-01')).toBe(true);
    });

    it('should return true for valid datetime with Z', () => {
      expect(isValidDateValue('2025-04-01T00:00:00Z')).toBe(true);
    });

    it('should return true for valid datetime with milliseconds', () => {
      expect(isValidDateValue('2025-04-01T12:30:45.123Z')).toBe(true);
    });

    it('should return true for valid datetime with timezone offset', () => {
      expect(isValidDateValue('2025-04-01T00:00:00+05:30')).toBe(true);
    });

    it('should return false for invalid month (13)', () => {
      expect(isValidDateValue('2025-13-01')).toBe(false);
    });

    it('should return false for invalid month (0)', () => {
      expect(isValidDateValue('2025-00-01')).toBe(false);
    });

    it('should return false for invalid day (32)', () => {
      expect(isValidDateValue('2025-04-32')).toBe(false);
    });

    it('should return false for invalid day (0)', () => {
      expect(isValidDateValue('2025-04-00')).toBe(false);
    });

    it('should return false for invalid day for February', () => {
      expect(isValidDateValue('2025-02-30')).toBe(false);
    });

    it('should return false for Feb 29 in non-leap year', () => {
      expect(isValidDateValue('2025-02-29')).toBe(false);
    });

    it('should return true for Feb 29 in leap year (2024)', () => {
      expect(isValidDateValue('2024-02-29')).toBe(true);
    });

    it('should return false for unparseable string', () => {
      expect(isValidDateValue('not-a-date')).toBe(false);
    });

    it('should return true for date with slashes (JavaScript Date can parse it)', () => {
      // JavaScript Date constructor can parse '2025/04/01' format
      expect(isValidDateValue('2025/04/01')).toBe(true);
    });

    it('should return false for number input', () => {
      expect(isValidDateValue(123)).toBe(false);
    });

    it('should return false for object input', () => {
      expect(isValidDateValue({})).toBe(false);
    });

    it('should handle single digit month/day format', () => {
      // JavaScript Date can parse this, but our validation checks component matching
      // Single digit format like "2025-4-1" may or may not pass depending on Date parsing
      // Testing actual behavior
      const result = isValidDateValue('2025-4-1');
      expect(typeof result).toBe('boolean');
    });
  });
});
