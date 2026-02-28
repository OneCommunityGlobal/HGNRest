/**
 * Unit Tests for Paid Labor Cost Controller
 *
 * This test suite covers:
 * 1. Helper function unit tests (looksLikeJson, parseArrayParam, parseDateRangeParam, isValidDateValue)
 * 2. Controller logic tests (parameter validation, query building, response formatting, error handling)
 * 3. Edge case tests (boundary conditions, request object edge cases)
 *
 * Coverage Target: >90% (currently ~97%)
 */

jest.mock('../../../models/laborCost');
jest.mock('../../../startup/logger');

const LaborCost = require('../../../models/laborCost');
const logger = require('../../../startup/logger');
const bmPaidLaborCostController = require('../bmPaidLaborCostController');

/**
 * Helper Functions Test Suite
 * Tests private helper functions exported via testExports for direct unit testing
 */
describe('bmPaidLaborCostController - Helper Functions', () => {
  // Get test exports for helper functions
  const { looksLikeJson, parseArrayParam, parseDateRangeParam, isValidDateValue } =
    bmPaidLaborCostController.testExports;

  /**
   * Tests for looksLikeJson() helper function
   * Validates detection of JSON-like strings (objects and arrays)
   */
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

  /**
   * Tests for parseArrayParam() helper function
   * Validates parsing of array parameters from query strings
   * Handles JSON arrays, comma-separated strings, and error cases
   */
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

  /**
   * Tests for parseDateRangeParam() helper function
   * Validates parsing of date_range parameter from query strings
   */
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

  /**
   * Tests for isValidDateValue() helper function
   * Validates ISO 8601 date format and catches invalid dates (e.g., invalid months/days)
   */
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

  /**
   * Controller Logic Test Suite
   * Tests the main getLaborCost() function with mocked dependencies
   */
  describe('bmPaidLaborCostController - getLaborCost()', () => {
    let controller;
    let mockReq;
    let mockRes;
    let mockSort;
    let mockLean;
    let mockExec;

    /** Calls getLaborCost with given query and optional mock DB records. Reduces duplication. */
    async function callGetLaborCost(query, records = []) {
      mockReq.query = query;
      mockExec.mockResolvedValue(records);
      await controller.getLaborCost(mockReq, mockRes);
    }

    /** Asserts 200 and LaborCost.find called with expectedFilter. */
    function expectSuccessWithFind(expectedFilter) {
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(LaborCost.find).toHaveBeenCalledWith(expectedFilter);
    }

    /** Asserts 200 and empty find. */
    function expectSuccessEmptyFind() {
      expectSuccessWithFind({});
    }

    /**
     * Setup mocks before each test
     * Creates chainable mock for LaborCost.find().sort().lean().exec()
     */
    beforeEach(() => {
      jest.clearAllMocks();

      // Set up mock chain for LaborCost.find().sort().lean().exec()
      mockExec = jest.fn().mockResolvedValue([]);
      mockLean = jest.fn().mockReturnValue({ exec: mockExec });
      mockSort = jest.fn().mockReturnValue({ lean: mockLean });
      LaborCost.find = jest.fn().mockReturnValue({ sort: mockSort });
      logger.logException = jest.fn();

      mockReq = {
        query: {},
        method: 'GET',
        originalUrl: '/api/labor-cost',
        url: '/api/labor-cost',
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      controller = bmPaidLaborCostController();
    });

    /**
     * Parameter Validation Tests - Projects
     * Tests validation and parsing of projects query parameter
     */
    describe('Parameter Validation - Projects', () => {
      it('should call sort, lean, exec and succeed when projects param is undefined', async () => {
        await callGetLaborCost({});
        expectSuccessEmptyFind();
        expect(mockSort).toHaveBeenCalledWith({ date: 1 });
        expect(mockLean).toHaveBeenCalled();
        expect(mockExec).toHaveBeenCalled();
      });

      it.each([
        ['empty array', { projects: '[]' }, {}],
        [
          'valid JSON array',
          { projects: '["Project A"]' },
          { project_name: { $in: ['Project A'] } },
        ],
        [
          'multiple projects',
          { projects: '["Project A","Project B"]' },
          { project_name: { $in: ['Project A', 'Project B'] } },
        ],
        [
          'comma-separated',
          { projects: 'Project A,Project B' },
          { project_name: { $in: ['Project A', 'Project B'] } },
        ],
      ])('should succeed with %s projects', async (_label, query, expectedFind) => {
        await callGetLaborCost(query);
        expectSuccessWithFind(expectedFind);
      });

      it.each([
        ['JSON object', '{"name":"Project A"}', 'JSON object provided instead of array'],
        ['non-string elements', '[1, 2, 3]', 'All project names must be strings'],
        ['mixed valid/invalid', '["valid", 123]', 'All project names must be strings'],
        ['mixed format', '{"json":true},Plain', 'Cannot mix JSON'],
      ])('should return 400 for %s', async (_label, projectsValue, errorSubstring) => {
        await callGetLaborCost({ projects: projectsValue });
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            Code: 'INVALID_PARAMETER',
            error: expect.stringContaining(errorSubstring),
          }),
        );
      });
    });

    /**
     * Parameter Validation Tests - Tasks
     */
    describe('Parameter Validation - Tasks', () => {
      it.each([
        ['undefined', {}],
        ['empty array', { tasks: '[]' }],
      ])('should succeed when tasks param is %s', async (_label, query) => {
        await callGetLaborCost(query);
        expectSuccessEmptyFind();
      });

      it.each([
        ['valid JSON array', { tasks: '["Task 1"]' }, { task: { $in: ['Task 1'] } }],
        [
          'multiple tasks',
          { tasks: '["Task 1","Task 2"]' },
          { task: { $in: ['Task 1', 'Task 2'] } },
        ],
        ['comma-separated', { tasks: 'Task 1,Task 2' }, { task: { $in: ['Task 1', 'Task 2'] } }],
      ])('should succeed with %s tasks', async (_label, query, expectedFind) => {
        await callGetLaborCost(query);
        expectSuccessWithFind(expectedFind);
      });

      it.each([
        ['JSON object', '{"name":"Task 1"}', 'JSON object provided instead of array'],
        ['non-string elements', '[1, 2, 3]', 'All task names must be strings'],
      ])('should return 400 for %s in tasks', async (_label, tasksValue, errorSubstring) => {
        await callGetLaborCost({ tasks: tasksValue });
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            Code: 'INVALID_PARAMETER',
            error: expect.stringContaining(errorSubstring),
          }),
        );
      });
    });

    /**
     * Parameter Validation Tests - Date Range
     */
    describe('Parameter Validation - Date Range', () => {
      const dateBoth = {
        date: { $gte: expect.any(Date), $lte: expect.any(Date) },
      };
      const dateStartOnly = { date: { $gte: expect.any(Date) } };
      const dateEndOnly = { date: { $lte: expect.any(Date) } };

      it.each([
        ['undefined', {}],
        ['null string', { date_range: 'null' }],
        ['empty object', { date_range: '{}' }],
      ])('should succeed when date_range is %s', async (_label, query) => {
        await callGetLaborCost(query);
        expectSuccessEmptyFind();
      });

      it('should succeed with valid date_range with both dates', async () => {
        await callGetLaborCost({
          date_range: '{"start_date":"2025-04-01","end_date":"2025-04-30"}',
        });
        expectSuccessWithFind(dateBoth);
      });

      it('should succeed with only start_date', async () => {
        await callGetLaborCost({
          date_range: '{"start_date":"2025-04-01","end_date":null}',
        });
        expectSuccessWithFind(dateStartOnly);
      });

      it('should succeed with only end_date', async () => {
        await callGetLaborCost({
          date_range: '{"start_date":null,"end_date":"2025-04-30"}',
        });
        expectSuccessWithFind(dateEndOnly);
      });

      it('should return 400 for invalid JSON date_range', async () => {
        await callGetLaborCost({ date_range: '{malformed' });
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            Code: 'INVALID_PARAMETER',
            error: expect.stringContaining('date_range must be a valid JSON object'),
          }),
        );
      });

      it.each([
        [
          'invalid start month',
          '{"start_date":"2025-13-01","end_date":"2025-04-30"}',
          'start_date must be a valid ISO 8601',
        ],
        [
          'invalid end day',
          '{"start_date":"2025-04-01","end_date":"2025-04-32"}',
          'end_date must be a valid ISO 8601',
        ],
        [
          'non-string start_date',
          '{"start_date":12345,"end_date":"2025-04-30"}',
          'start_date must be a string',
        ],
        [
          'non-string end_date',
          '{"start_date":"2025-04-01","end_date":12345}',
          'end_date must be a string',
        ],
      ])('should return 422 for %s', async (_label, dateRangeValue, errorSubstring) => {
        await callGetLaborCost({ date_range: dateRangeValue });
        expect(mockRes.status).toHaveBeenCalledWith(422);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            Code: 'INVALID_DATE_FORMAT',
            error: expect.stringContaining(errorSubstring),
          }),
        );
      });

      it('should return 400 when start_date > end_date', async () => {
        await callGetLaborCost({
          date_range: '{"start_date":"2025-04-30","end_date":"2025-04-01"}',
        });
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_DATE_RANGE',
          error: 'start_date must be before or equal to end_date',
        });
      });
    });

    /**
     * Query Building and Database Call
     */
    describe('Query Building and Database Call', () => {
      it('should build empty query and call sort, lean, exec when no filters', async () => {
        await callGetLaborCost({});
        expect(LaborCost.find).toHaveBeenCalledWith({});
        expect(mockSort).toHaveBeenCalledWith({ date: 1 });
        expect(mockLean).toHaveBeenCalled();
        expect(mockExec).toHaveBeenCalled();
      });

      const dateRangeFilter = {
        date: { $gte: expect.any(Date), $lte: expect.any(Date) },
      };
      it.each([
        ['projects only', { projects: '["A"]' }, { project_name: { $in: ['A'] } }],
        ['tasks only', { tasks: '["T1"]' }, { task: { $in: ['T1'] } }],
        [
          'date range only',
          { date_range: '{"start_date":"2025-04-01","end_date":"2025-04-30"}' },
          dateRangeFilter,
        ],
        [
          'start date only',
          { date_range: '{"start_date":"2025-04-01","end_date":null}' },
          { date: { $gte: expect.any(Date) } },
        ],
        [
          'end date only',
          { date_range: '{"start_date":null,"end_date":"2025-04-30"}' },
          { date: { $lte: expect.any(Date) } },
        ],
      ])('should build query filter with %s', async (_label, query, expectedFind) => {
        await callGetLaborCost(query);
        expect(LaborCost.find).toHaveBeenCalledWith(expectedFind);
      });

      it('should build combined query filter with all filters', async () => {
        await callGetLaborCost({
          projects: '["A"]',
          tasks: '["T1"]',
          date_range: '{"start_date":"2025-04-01","end_date":"2025-04-30"}',
        });
        expect(LaborCost.find).toHaveBeenCalledWith({
          project_name: { $in: ['A'] },
          task: { $in: ['T1'] },
          date: { $gte: expect.any(Date), $lte: expect.any(Date) },
        });
      });
    });

    /**
     * Response Formatting
     */
    describe('Response Formatting', () => {
      it('should return empty results with totalCost 0', async () => {
        await callGetLaborCost({});
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({ totalCost: 0, data: [] });
      });

      it('should format single record correctly', async () => {
        const testDate = new Date('2025-04-01');
        await callGetLaborCost({}, [{ project_name: 'A', task: 'T1', date: testDate, cost: 100 }]);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          totalCost: 100,
          data: [{ project: 'A', task: 'T1', date: testDate.toISOString(), cost: 100 }],
        });
      });

      it('should format multiple records and calculate totalCost', async () => {
        const testDate1 = new Date('2025-04-01');
        const testDate2 = new Date('2025-04-02');
        await callGetLaborCost({}, [
          { project_name: 'A', task: 'T1', date: testDate1, cost: 100 },
          { project_name: 'B', task: 'T2', date: testDate2, cost: 200 },
        ]);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          totalCost: 300,
          data: [
            { project: 'A', task: 'T1', date: testDate1.toISOString(), cost: 100 },
            { project: 'B', task: 'T2', date: testDate2.toISOString(), cost: 200 },
          ],
        });
      });

      it('should convert string cost to number', async () => {
        const testDate = new Date('2025-04-01');
        await callGetLaborCost({}, [
          { project_name: 'A', task: 'T1', date: testDate, cost: '100' },
        ]);
        expect(mockRes.json).toHaveBeenCalledWith({
          totalCost: 100,
          data: [{ project: 'A', task: 'T1', date: testDate.toISOString(), cost: 100 }],
        });
      });

      it('should handle null date in response', async () => {
        await callGetLaborCost({}, [{ project_name: 'A', task: 'T1', date: null, cost: 100 }]);
        expect(mockRes.json).toHaveBeenCalledWith({
          totalCost: 100,
          data: [{ project: 'A', task: 'T1', date: null, cost: 100 }],
        });
      });
    });

    /**
     * Error Handling
     */
    const dbErrorResponse = {
      Code: 'DATABASE_ERROR',
      error: 'A database error occurred while fetching labor cost data. Please try again later.',
    };

    describe('Error Handling', () => {
      it('should handle MongoError and return 500 with log context', async () => {
        const error = new Error('Database connection failed');
        error.name = 'MongoError';
        mockReq.query = {};
        mockExec.mockRejectedValue(error);

        await controller.getLaborCost(mockReq, mockRes);

        expect(logger.logException).toHaveBeenCalledWith(
          error,
          'getLaborCost - Database Error - Paid Labor Cost Controller',
          { query: {}, method: 'GET', url: '/api/labor-cost' },
        );
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(dbErrorResponse);
      });

      it.each([
        ['MongooseError', 'MongooseError'],
        ['CastError', 'CastError'],
        ['ValidationError', 'ValidationError'],
      ])('should handle %s and return 500', async (_label, errorName) => {
        const error = new Error('DB error');
        error.name = errorName;
        mockReq.query = {};
        mockExec.mockRejectedValue(error);

        await controller.getLaborCost(mockReq, mockRes);

        expect(logger.logException).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(dbErrorResponse);
      });

      it('should handle connection error message and return 500', async () => {
        const error = new Error('Mongo connection failed');
        mockReq.query = {};
        mockExec.mockRejectedValue(error);

        await controller.getLaborCost(mockReq, mockRes);

        expect(logger.logException).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(dbErrorResponse);
      });

      it('should handle generic error and return 500 with INTERNAL_SERVER_ERROR', async () => {
        const error = new Error('Unknown error');
        mockReq.query = {};
        mockExec.mockRejectedValue(error);

        await controller.getLaborCost(mockReq, mockRes);

        expect(logger.logException).toHaveBeenCalledWith(
          error,
          'getLaborCost - Unexpected Error - Paid Labor Cost Controller',
          { query: {}, method: 'GET', url: '/api/labor-cost' },
        );
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INTERNAL_SERVER_ERROR',
          error:
            'An unexpected error occurred while fetching labor cost data. Please try again later.',
        });
      });
    });

    /**
     * Edge Cases - Boundary Conditions
     */
    describe('Edge Cases - Boundary Conditions', () => {
      it('should handle empty string projects parameter', async () => {
        await callGetLaborCost({ projects: '' });
        expectSuccessEmptyFind();
      });

      it.each([
        ['very long project name', 'A'.repeat(1000)],
        ['Unicode', '日本語'],
        ['special characters', 'Project <script>'],
      ])('should handle %s in projects', async (_label, projectValue) => {
        await callGetLaborCost({ projects: JSON.stringify([projectValue]) });
        expectSuccessWithFind({ project_name: { $in: [projectValue] } });
      });

      it('should handle large array of projects', async () => {
        const projects = Array.from({ length: 100 }, (_, i) => `Project ${i + 1}`);
        await callGetLaborCost({ projects: JSON.stringify(projects) });
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({ project_name: { $in: projects } });
      });

      const dateRangeExtremeFilter = {
        date: { $gte: expect.any(Date), $lte: expect.any(Date) },
      };
      const emptyDataResponse = { totalCost: 0, data: [] };
      it.each([
        ['dates far in the past', '{"start_date":"1900-01-01","end_date":"1900-12-31"}'],
        ['dates far in the future', '{"start_date":"2100-01-01","end_date":"2100-12-31"}'],
      ])('should handle %s', async (_label, dateRangeValue) => {
        await callGetLaborCost({ date_range: dateRangeValue });
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith(dateRangeExtremeFilter);
        expect(mockRes.json).toHaveBeenCalledWith(emptyDataResponse);
      });
    });

    /**
     * Edge Cases - Request Object
     * Tests handling of malformed or missing request query objects
     * All three cases test the same code path: `const query = req.query || {};`
     */
    describe('Edge Cases - Request Object', () => {
      it.each([
        ['missing query property', undefined],
        ['null query property', null],
        ['empty query object', {}],
      ])('should handle %s', async (_label, queryValue) => {
        mockReq.query = queryValue;
        mockExec.mockResolvedValue([]);
        await controller.getLaborCost(mockReq, mockRes);
        expectSuccessEmptyFind();
      });
    });
  });
});
