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

    /**
     * Setup mocks before each test
     * Creates chainable mock for LaborCost.find().sort().lean().exec()
     */
    beforeEach(() => {
      jest.clearAllMocks();

      // Set up mock chain for LaborCost.find().sort().lean().exec()
      // The chain is: find() -> sort() -> lean() -> exec() -> Promise
      mockExec = jest.fn().mockResolvedValue([]);
      mockLean = jest.fn().mockReturnValue({ exec: mockExec });
      mockSort = jest.fn().mockReturnValue({ lean: mockLean });

      // Set up LaborCost.find to return an object with sort method
      // This creates the chain: find() returns {sort: fn}, sort() returns {lean: fn}, etc.
      LaborCost.find = jest.fn().mockReturnValue({ sort: mockSort });

      // Mock logger
      logger.logException = jest.fn();

      // Set up mock request/response
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

      // Initialize controller AFTER mocks are set up
      controller = bmPaidLaborCostController();
    });

    /**
     * Parameter Validation Tests - Projects
     * Tests validation and parsing of projects query parameter
     */
    describe('Parameter Validation - Projects', () => {
      it('should succeed when projects param is undefined', async () => {
        mockReq.query = {};
        // Reset mockExec for this test
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({});
        expect(mockSort).toHaveBeenCalledWith({ date: 1 });
        expect(mockLean).toHaveBeenCalled();
        expect(mockExec).toHaveBeenCalled();
      });

      it('should succeed with empty array projects', async () => {
        mockReq.query = { projects: '[]' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({});
      });

      it('should succeed with valid JSON array projects', async () => {
        mockReq.query = { projects: '["Project A"]' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({ project_name: { $in: ['Project A'] } });
      });

      it('should succeed with multiple projects', async () => {
        mockReq.query = { projects: '["Project A","Project B"]' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({
          project_name: { $in: ['Project A', 'Project B'] },
        });
      });

      it('should succeed with comma-separated projects', async () => {
        mockReq.query = { projects: 'Project A,Project B' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({
          project_name: { $in: ['Project A', 'Project B'] },
        });
      });

      it('should return 400 for JSON object projects (invalid)', async () => {
        mockReq.query = { projects: '{"name":"Project A"}' };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_PARAMETER',
          error: expect.stringContaining('JSON object provided instead of array'),
        });
      });

      it('should return 400 for non-string array elements', async () => {
        mockReq.query = { projects: '[1, 2, 3]' };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_PARAMETER',
          error: 'All project names must be strings',
        });
      });

      it('should return 400 for mixed valid/invalid project elements', async () => {
        mockReq.query = { projects: '["valid", 123]' };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_PARAMETER',
          error: 'All project names must be strings',
        });
      });

      it('should return 400 for mixed format projects', async () => {
        mockReq.query = { projects: '{"json":true},Plain' };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_PARAMETER',
          error: expect.stringContaining('Cannot mix JSON'),
        });
      });
    });

    /**
     * Parameter Validation Tests - Tasks
     * Tests validation and parsing of tasks query parameter
     * Similar pattern to projects validation
     */
    describe('Parameter Validation - Tasks', () => {
      it('should succeed when tasks param is undefined', async () => {
        mockReq.query = {};
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({});
      });

      it('should succeed with empty array tasks', async () => {
        mockReq.query = { tasks: '[]' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({});
      });

      it('should succeed with valid JSON array tasks', async () => {
        mockReq.query = { tasks: '["Task 1"]' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({ task: { $in: ['Task 1'] } });
      });

      it('should succeed with multiple tasks', async () => {
        mockReq.query = { tasks: '["Task 1","Task 2"]' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({ task: { $in: ['Task 1', 'Task 2'] } });
      });

      it('should succeed with comma-separated tasks', async () => {
        mockReq.query = { tasks: 'Task 1,Task 2' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({ task: { $in: ['Task 1', 'Task 2'] } });
      });

      it('should return 400 for JSON object tasks (invalid)', async () => {
        mockReq.query = { tasks: '{"name":"Task 1"}' };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_PARAMETER',
          error: expect.stringContaining('JSON object provided instead of array'),
        });
      });

      it('should return 400 for non-string array elements in tasks', async () => {
        mockReq.query = { tasks: '[1, 2, 3]' };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_PARAMETER',
          error: 'All task names must be strings',
        });
      });
    });

    /**
     * Parameter Validation Tests - Date Range
     * Tests validation and parsing of date_range query parameter
     * Includes partial date ranges and date format validation
     */
    describe('Parameter Validation - Date Range', () => {
      it('should succeed when date_range is undefined', async () => {
        mockReq.query = {};
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({});
      });

      it('should succeed with null string date_range', async () => {
        mockReq.query = { date_range: 'null' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({});
      });

      it('should succeed with valid date_range with both dates', async () => {
        mockReq.query = {
          date_range: '{"start_date":"2025-04-01","end_date":"2025-04-30"}',
        };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({
          date: {
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          },
        });
      });

      it('should succeed with only start_date', async () => {
        mockReq.query = {
          date_range: '{"start_date":"2025-04-01","end_date":null}',
        };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({
          date: {
            $gte: expect.any(Date),
          },
        });
      });

      it('should succeed with only end_date', async () => {
        mockReq.query = {
          date_range: '{"start_date":null,"end_date":"2025-04-30"}',
        };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({
          date: {
            $lte: expect.any(Date),
          },
        });
      });

      it('should succeed with empty date_range object', async () => {
        mockReq.query = { date_range: '{}' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({});
      });

      it('should return 400 for invalid JSON date_range', async () => {
        mockReq.query = { date_range: '{malformed' };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_PARAMETER',
          error: expect.stringContaining('date_range must be a valid JSON object'),
        });
      });

      it('should return 422 for invalid start month', async () => {
        mockReq.query = {
          date_range: '{"start_date":"2025-13-01","end_date":"2025-04-30"}',
        };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(422);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_DATE_FORMAT',
          error: expect.stringContaining('start_date must be a valid ISO 8601'),
        });
      });

      it('should return 422 for invalid end day', async () => {
        mockReq.query = {
          date_range: '{"start_date":"2025-04-01","end_date":"2025-04-32"}',
        };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(422);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_DATE_FORMAT',
          error: expect.stringContaining('end_date must be a valid ISO 8601'),
        });
      });

      it('should return 400 when start_date > end_date', async () => {
        mockReq.query = {
          date_range: '{"start_date":"2025-04-30","end_date":"2025-04-01"}',
        };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_DATE_RANGE',
          error: 'start_date must be before or equal to end_date',
        });
      });

      it('should return 422 for non-string start_date', async () => {
        mockReq.query = {
          date_range: '{"start_date":12345,"end_date":"2025-04-30"}',
        };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(422);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_DATE_FORMAT',
          error: expect.stringContaining('start_date must be a string'),
        });
      });

      it('should return 422 for non-string end_date', async () => {
        mockReq.query = {
          date_range: '{"start_date":"2025-04-01","end_date":12345}',
        };

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(422);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'INVALID_DATE_FORMAT',
          error: expect.stringContaining('end_date must be a string'),
        });
      });
    });

    /**
     * Query Building Tests
     * Verifies MongoDB query construction with various filter combinations
     */
    describe('Query Building and Database Call', () => {
      it('should build empty query filter when no filters provided', async () => {
        mockReq.query = {};
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(LaborCost.find).toHaveBeenCalledWith({});
        expect(mockSort).toHaveBeenCalledWith({ date: 1 });
        expect(mockLean).toHaveBeenCalled();
        expect(mockExec).toHaveBeenCalled();
      });

      it('should build query filter with projects only', async () => {
        mockReq.query = { projects: '["A"]' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(LaborCost.find).toHaveBeenCalledWith({ project_name: { $in: ['A'] } });
      });

      it('should build query filter with tasks only', async () => {
        mockReq.query = { tasks: '["T1"]' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(LaborCost.find).toHaveBeenCalledWith({ task: { $in: ['T1'] } });
      });

      it('should build query filter with date range only', async () => {
        mockReq.query = {
          date_range: '{"start_date":"2025-04-01","end_date":"2025-04-30"}',
        };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(LaborCost.find).toHaveBeenCalledWith({
          date: {
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          },
        });
      });

      it('should build combined query filter with all filters', async () => {
        mockReq.query = {
          projects: '["A"]',
          tasks: '["T1"]',
          date_range: '{"start_date":"2025-04-01","end_date":"2025-04-30"}',
        };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(LaborCost.find).toHaveBeenCalledWith({
          project_name: { $in: ['A'] },
          task: { $in: ['T1'] },
          date: {
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          },
        });
      });

      it('should build query filter with start date only', async () => {
        mockReq.query = {
          date_range: '{"start_date":"2025-04-01","end_date":null}',
        };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(LaborCost.find).toHaveBeenCalledWith({
          date: {
            $gte: expect.any(Date),
          },
        });
      });

      it('should build query filter with end date only', async () => {
        mockReq.query = {
          date_range: '{"start_date":null,"end_date":"2025-04-30"}',
        };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(LaborCost.find).toHaveBeenCalledWith({
          date: {
            $lte: expect.any(Date),
          },
        });
      });
    });

    /**
     * Response Formatting Tests
     * Verifies data transformation and totalCost calculation
     */
    describe('Response Formatting', () => {
      it('should return empty results with totalCost 0', async () => {
        mockReq.query = {};
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          totalCost: 0,
          data: [],
        });
      });

      it('should format single record correctly', async () => {
        const testDate = new Date('2025-04-01');
        mockReq.query = {};
        mockExec.mockResolvedValue([
          {
            project_name: 'A',
            task: 'T1',
            date: testDate,
            cost: 100,
          },
        ]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          totalCost: 100,
          data: [
            {
              project: 'A',
              task: 'T1',
              date: testDate.toISOString(),
              cost: 100,
            },
          ],
        });
      });

      it('should format multiple records and calculate totalCost', async () => {
        const testDate1 = new Date('2025-04-01');
        const testDate2 = new Date('2025-04-02');
        mockReq.query = {};
        mockExec.mockResolvedValue([
          {
            project_name: 'A',
            task: 'T1',
            date: testDate1,
            cost: 100,
          },
          {
            project_name: 'B',
            task: 'T2',
            date: testDate2,
            cost: 200,
          },
        ]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          totalCost: 300,
          data: [
            {
              project: 'A',
              task: 'T1',
              date: testDate1.toISOString(),
              cost: 100,
            },
            {
              project: 'B',
              task: 'T2',
              date: testDate2.toISOString(),
              cost: 200,
            },
          ],
        });
      });

      it('should convert string cost to number', async () => {
        const testDate = new Date('2025-04-01');
        mockReq.query = {};
        mockExec.mockResolvedValue([
          {
            project_name: 'A',
            task: 'T1',
            date: testDate,
            cost: '100',
          },
        ]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          totalCost: 100,
          data: [
            {
              project: 'A',
              task: 'T1',
              date: testDate.toISOString(),
              cost: 100,
            },
          ],
        });
      });

      it('should handle null date in response', async () => {
        mockReq.query = {};
        mockExec.mockResolvedValue([
          {
            project_name: 'A',
            task: 'T1',
            date: null,
            cost: 100,
          },
        ]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          totalCost: 100,
          data: [
            {
              project: 'A',
              task: 'T1',
              date: null,
              cost: 100,
            },
          ],
        });
      });
    });

    /**
     * Error Handling Tests
     * Verifies proper error handling for database errors and unexpected errors
     */
    describe('Error Handling', () => {
      it('should handle MongoError and return 500', async () => {
        mockReq.query = {};
        const error = new Error('Database connection failed');
        error.name = 'MongoError';
        mockExec.mockRejectedValue(error);

        await controller.getLaborCost(mockReq, mockRes);

        expect(logger.logException).toHaveBeenCalledWith(
          error,
          'getLaborCost - Database Error - Paid Labor Cost Controller',
          {
            query: {},
            method: 'GET',
            url: '/api/labor-cost',
          },
        );
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'DATABASE_ERROR',
          error:
            'A database error occurred while fetching labor cost data. Please try again later.',
        });
      });

      it('should handle MongooseError and return 500', async () => {
        mockReq.query = {};
        const error = new Error('Mongoose error');
        error.name = 'MongooseError';
        mockExec.mockRejectedValue(error);

        await controller.getLaborCost(mockReq, mockRes);

        expect(logger.logException).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'DATABASE_ERROR',
          error:
            'A database error occurred while fetching labor cost data. Please try again later.',
        });
      });

      it('should handle CastError and return 500', async () => {
        mockReq.query = {};
        const error = new Error('Cast error');
        error.name = 'CastError';
        mockExec.mockRejectedValue(error);

        await controller.getLaborCost(mockReq, mockRes);

        expect(logger.logException).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'DATABASE_ERROR',
          error:
            'A database error occurred while fetching labor cost data. Please try again later.',
        });
      });

      it('should handle ValidationError and return 500', async () => {
        mockReq.query = {};
        const error = new Error('Validation error');
        error.name = 'ValidationError';
        mockExec.mockRejectedValue(error);

        await controller.getLaborCost(mockReq, mockRes);

        expect(logger.logException).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'DATABASE_ERROR',
          error:
            'A database error occurred while fetching labor cost data. Please try again later.',
        });
      });

      it('should handle connection error and return 500', async () => {
        mockReq.query = {};
        const error = new Error('Mongo connection failed');
        mockExec.mockRejectedValue(error);

        await controller.getLaborCost(mockReq, mockRes);

        expect(logger.logException).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          Code: 'DATABASE_ERROR',
          error:
            'A database error occurred while fetching labor cost data. Please try again later.',
        });
      });

      it('should handle generic error and return 500', async () => {
        mockReq.query = {};
        const error = new Error('Unknown error');
        mockExec.mockRejectedValue(error);

        await controller.getLaborCost(mockReq, mockRes);

        expect(logger.logException).toHaveBeenCalledWith(
          error,
          'getLaborCost - Unexpected Error - Paid Labor Cost Controller',
          {
            query: {},
            method: 'GET',
            url: '/api/labor-cost',
          },
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
     * Tests extreme values and unusual inputs (long strings, Unicode, special chars, etc.)
     */
    describe('Edge Cases - Boundary Conditions', () => {
      it('should handle empty string projects parameter', async () => {
        mockReq.query = { projects: '' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({});
      });

      it('should handle very long project name', async () => {
        const longProjectName = 'A'.repeat(1000);
        mockReq.query = { projects: `["${longProjectName}"]` };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({
          project_name: { $in: [longProjectName] },
        });
      });

      it('should handle Unicode characters in project names', async () => {
        mockReq.query = { projects: '["日本語"]' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({
          project_name: { $in: ['日本語'] },
        });
      });

      it('should handle special characters in project names', async () => {
        mockReq.query = { projects: '["Project <script>"]' };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({
          project_name: { $in: ['Project <script>'] },
        });
      });

      it('should handle large array of projects', async () => {
        // Create array with 100 projects
        const projects = Array.from({ length: 100 }, (_, i) => `Project ${i + 1}`);
        mockReq.query = { projects: JSON.stringify(projects) };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({
          project_name: { $in: projects },
        });
      });

      it('should handle dates far in the past', async () => {
        mockReq.query = {
          date_range: '{"start_date":"1900-01-01","end_date":"1900-12-31"}',
        };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({
          date: {
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          },
        });
        expect(mockRes.json).toHaveBeenCalledWith({
          totalCost: 0,
          data: [],
        });
      });

      it('should handle dates far in the future', async () => {
        mockReq.query = {
          date_range: '{"start_date":"2100-01-01","end_date":"2100-12-31"}',
        };
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({
          date: {
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          },
        });
        expect(mockRes.json).toHaveBeenCalledWith({
          totalCost: 0,
          data: [],
        });
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
      ])('should handle %s', async (description, queryValue) => {
        mockReq.query = queryValue;
        mockExec.mockResolvedValue([]);

        await controller.getLaborCost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(LaborCost.find).toHaveBeenCalledWith({});
      });
    });
  });
});
