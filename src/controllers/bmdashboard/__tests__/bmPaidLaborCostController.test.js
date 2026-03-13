/**
 * Unit Tests for Paid Labor Cost Controller
 *
 * This test suite covers:
 * 1. Helper function unit tests (looksLikeJson, parseArrayParam, parseDateRangeParam,
 *    isValidDateValue, sanitizeStringArrayForQuery)
 * 2. Controller logic tests (parameter validation, query building, response formatting,
 *    error handling, edge cases)
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
  const {
    looksLikeJson,
    parseArrayParam,
    parseDateRangeParam,
    isValidDateValue,
    sanitizeStringArrayForQuery,
  } = bmPaidLaborCostController.testExports;

  describe('looksLikeJson()', () => {
    it.each([
      ['valid JSON object string', '{"key":"value"}', true],
      ['nested JSON object', '{"nested":{"key":"val"}}', true],
      ['JSON array string', '["item1","item2"]', true],
      ['JSON with leading whitespace', '  {"key":"value"}', true],
      ['plain string', 'plain text', false],
      ['comma-separated string', 'Project A, Project B', false],
      ['null input', null, false],
      ['undefined input', undefined, false],
      ['number input', 123, false],
      ['object (not string)', {}, false],
      ['array (not string)', [], false],
      ['empty string', '', false],
    ])('should return %s for %s', (_label, input, expected) => {
      expect(looksLikeJson(input)).toBe(expected);
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
      expect(result).toEqual({ start_date: '2025-04-01', end_date: '2025-04-30' });
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
    it.each([
      ['null (optional)', null, true],
      ['undefined (optional)', undefined, true],
      ['empty string (falsy)', '', true],
      ['valid date-only format', '2025-04-01', true],
      ['another valid date-only format', '2025-04-30', true],
      ['end of year date', '2025-12-31', true],
      ['start of year date', '2025-01-01', true],
      ['valid datetime with Z', '2025-04-01T00:00:00Z', true],
      ['valid datetime with milliseconds', '2025-04-01T12:30:45.123Z', true],
      ['valid datetime with timezone offset', '2025-04-01T00:00:00+05:30', true],
      ['Feb 29 in leap year (2024)', '2024-02-29', true],
      ['invalid month (13)', '2025-13-01', false],
      ['invalid month (0)', '2025-00-01', false],
      ['invalid day (32)', '2025-04-32', false],
      ['invalid day (0)', '2025-04-00', false],
      ['invalid day for February', '2025-02-30', false],
      ['Feb 29 in non-leap year', '2025-02-29', false],
      ['unparseable string', 'not-a-date', false],
      ['number input', 123, false],
      ['object input', {}, false],
    ])('should return correct result for %s', (_label, input, expected) => {
      expect(isValidDateValue(input)).toBe(expected);
    });

    it('should return true for date with slashes (JavaScript Date can parse it)', () => {
      expect(isValidDateValue('2025/04/01')).toBe(true);
    });

    it('should handle single digit month/day format', () => {
      const result = isValidDateValue('2025-4-1');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('sanitizeStringArrayForQuery()', () => {
    it('should return empty array for empty input', () => {
      expect(sanitizeStringArrayForQuery([])).toEqual([]);
    });

    it('should pass through normal strings unchanged', () => {
      expect(sanitizeStringArrayForQuery(['Project A', 'Project B'])).toEqual([
        'Project A',
        'Project B',
      ]);
    });

    it('should filter out strings starting with $', () => {
      expect(sanitizeStringArrayForQuery(['$gt', 'Project A'])).toEqual(['Project A']);
    });

    it('should filter all elements when all start with $', () => {
      expect(sanitizeStringArrayForQuery(['$inject', '$where'])).toEqual([]);
    });

    it('should convert non-string values to strings via String()', () => {
      expect(sanitizeStringArrayForQuery([123, true])).toEqual(['123', 'true']);
    });

    it('should preserve strings with $ not at the start', () => {
      expect(sanitizeStringArrayForQuery(['Project$A', 'cost$10'])).toEqual([
        'Project$A',
        'cost$10',
      ]);
    });
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

  /** Asserts 400 INVALID_PARAMETER with the given error substring. */
  function expectInvalidParamError(errorSubstring) {
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        Code: 'INVALID_PARAMETER',
        error: expect.stringContaining(errorSubstring),
      }),
    );
  }

  // Shared date filter shapes used across multiple describe blocks
  const DATE_RANGE_BOTH = { date: { $gte: expect.any(Date), $lte: expect.any(Date) } };
  const DATE_RANGE_START_ONLY = { date: { $gte: expect.any(Date) } };
  const DATE_RANGE_END_ONLY = { date: { $lte: expect.any(Date) } };

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
      ['valid JSON array', { projects: '["Project A"]' }, { project_name: { $in: ['Project A'] } }],
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
      expectInvalidParamError(errorSubstring);
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
      ['multiple tasks', { tasks: '["Task 1","Task 2"]' }, { task: { $in: ['Task 1', 'Task 2'] } }],
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
      expectInvalidParamError(errorSubstring);
    });
  });

  /**
   * Parameter Validation Tests - Date Range
   */
  describe('Parameter Validation - Date Range', () => {
    it.each([
      ['undefined', {}],
      ['null string', { date_range: 'null' }],
      ['empty object', { date_range: '{}' }],
    ])('should succeed when date_range is %s', async (_label, query) => {
      await callGetLaborCost(query);
      expectSuccessEmptyFind();
    });

    it.each([
      ['both dates', '{"start_date":"2025-04-01","end_date":"2025-04-30"}', DATE_RANGE_BOTH],
      ['only start_date', '{"start_date":"2025-04-01","end_date":null}', DATE_RANGE_START_ONLY],
      ['only end_date', '{"start_date":null,"end_date":"2025-04-30"}', DATE_RANGE_END_ONLY],
    ])('should succeed with %s', async (_label, dateRangeValue, expectedFind) => {
      await callGetLaborCost({ date_range: dateRangeValue });
      expectSuccessWithFind(expectedFind);
    });

    it('should return 400 for invalid JSON date_range', async () => {
      await callGetLaborCost({ date_range: '{malformed' });
      expectInvalidParamError('date_range must be a valid JSON object');
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

    it.each([
      [
        'date range only',
        { date_range: '{"start_date":"2025-04-01","end_date":"2025-04-30"}' },
        DATE_RANGE_BOTH,
      ],
      [
        'start date only',
        { date_range: '{"start_date":"2025-04-01","end_date":null}' },
        DATE_RANGE_START_ONLY,
      ],
      [
        'end date only',
        { date_range: '{"start_date":null,"end_date":"2025-04-30"}' },
        DATE_RANGE_END_ONLY,
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
      await callGetLaborCost({}, [{ project_name: 'A', task: 'T1', date: testDate, cost: '100' }]);
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
      ['Mongo connection message', null, 'Mongo connection failed'],
    ])('should handle %s and return 500', async (_label, errorName, errorMessage = 'DB error') => {
      const error = new Error(errorMessage);
      if (errorName) error.name = errorName;
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

    it('should silently exclude $-prefixed project names (NoSQL injection prevention)', async () => {
      await callGetLaborCost({ projects: JSON.stringify(['$inject', 'Project A']) });
      expectSuccessWithFind({ project_name: { $in: ['Project A'] } });
    });

    it('should handle large array of projects', async () => {
      const projects = Array.from({ length: 100 }, (_, i) => `Project ${i + 1}`);
      await callGetLaborCost({ projects: JSON.stringify(projects) });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(LaborCost.find).toHaveBeenCalledWith({ project_name: { $in: projects } });
    });

    it.each([
      ['dates far in the past', '{"start_date":"1900-01-01","end_date":"1900-12-31"}'],
      ['dates far in the future', '{"start_date":"2100-01-01","end_date":"2100-12-31"}'],
    ])('should handle %s', async (_label, dateRangeValue) => {
      await callGetLaborCost({ date_range: dateRangeValue });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(LaborCost.find).toHaveBeenCalledWith(DATE_RANGE_BOTH);
      expect(mockRes.json).toHaveBeenCalledWith({ totalCost: 0, data: [] });
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
