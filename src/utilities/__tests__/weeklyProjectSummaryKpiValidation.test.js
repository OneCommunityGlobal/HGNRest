const { validateKpiQuery } = require('../weeklyProjectSummaryKpiValidation');

const validQuery = {
  startDate: '2024-02-29',
  endDate: '2024-03-01',
  trendDays: '7',
  projectId: '507f1f77bcf86cd799439011',
};

describe('validateKpiQuery', () => {
  test.each(['7', '30', '90'])('accepts trendDays %s', (trendDays) => {
    expect(validateKpiQuery({ ...validQuery, trendDays })).toBeNull();
  });

  test.each(['all', '507f1f77bcf86cd799439011', 'ABCDEF012345abcdef012345'])(
    'accepts projectId %s without modifying it',
    (projectId) => {
      const query = { ...validQuery, projectId };
      expect(validateKpiQuery(query)).toBeNull();
      expect(query.projectId).toBe(projectId);
    },
  );

  test.each(['2024-02-29', '2000-02-29', '1900-02-28', '0099-01-01', '2011-12-30'])(
    'accepts a valid single-day range on %s',
    (date) => {
      expect(validateKpiQuery({ ...validQuery, startDate: date, endDate: date })).toBeNull();
    },
  );

  test.each(['startDate', 'endDate', 'trendDays', 'projectId'])(
    'requires %s when missing, null, undefined, or empty',
    (field) => {
      const query = { ...validQuery };
      delete query[field];
      expect(validateKpiQuery(query)).toBe(`${field} is required`);
      [null, undefined, ''].forEach((value) => {
        expect(validateKpiQuery({ ...validQuery, [field]: value })).toBe(`${field} is required`);
      });
    },
  );

  test.each([null, undefined, [], 'query', 1])('rejects invalid query objects: %p', (query) => {
    expect(validateKpiQuery(query)).toBe('query must be an object');
  });

  test.each([
    '2024-2-29',
    '2024-02-29T00:00:00Z',
    ' 2024-02-29',
    '2024-02-29\n',
    '2023-02-29',
    '1900-02-29',
    '2024-04-31',
    '2024-13-01',
    '2024-00-01',
    '2024-01-00',
  ])('rejects invalid or impossible date %p in either date field', (date) => {
    expect(validateKpiQuery({ ...validQuery, startDate: date })).toBe(
      'startDate must be a valid YYYY-MM-DD date',
    );
    expect(validateKpiQuery({ ...validQuery, endDate: date })).toBe(
      'endDate must be a valid YYYY-MM-DD date',
    );
  });

  test('rejects reversed date ranges', () => {
    expect(validateKpiQuery({ ...validQuery, startDate: '2024-03-02' })).toBe(
      'startDate must be before or equal to endDate',
    );
  });

  test.each(['0', '8', '07', '7.0', ' 7', '7\n', 7, 30, true])(
    'rejects invalid trendDays %p',
    (trendDays) => {
      expect(validateKpiQuery({ ...validQuery, trendDays })).toBe('trendDays must be 7, 30, or 90');
    },
  );

  test.each([
    'All',
    ' all',
    '507f1f77bcf86cd79943901',
    '507f1f77bcf86cd7994390110',
    '507f1f77bcf86cd79943901g',
    'abcdefghijkl',
    '507f1f77bcf86cd799439011\n',
    507,
    true,
  ])('rejects malformed projectId %p', (projectId) => {
    expect(validateKpiQuery({ ...validQuery, projectId })).toBe(
      'projectId must be a 24-character hexadecimal ObjectId or "all"',
    );
  });

  test.each(['startDate', 'endDate', 'trendDays', 'projectId'])(
    'rejects arrays and operator objects for %s',
    (field) => {
      const expected = {
        startDate: 'startDate must be a valid YYYY-MM-DD date',
        endDate: 'endDate must be a valid YYYY-MM-DD date',
        trendDays: 'trendDays must be 7, 30, or 90',
        projectId: 'projectId must be a 24-character hexadecimal ObjectId or "all"',
      }[field];
      [[validQuery[field]], [], { $ne: null }, { value: validQuery[field] }].forEach((value) => {
        expect(validateKpiQuery({ ...validQuery, [field]: value })).toBe(expected);
      });
    },
  );
});
