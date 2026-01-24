const { parseDurationValue } = require('./analyticsPopularPRsControllerHelper');

describe('Test parseDurationValue', () => {
  const fixedDate = new Date('2025-08-13T12:00:00Z'); // A Wednesday
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(fixedDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('lastWeek returns the Sunday before last as start, and last Sunday as end', () => {
    const [start, end] = parseDurationValue('lastWeek');
    expect(start.toISOString()).toBe('2025-08-03T00:00:00.000Z'); // Sunday a week before last Sunday
    expect(end.toISOString()).toBe('2025-08-10T00:00:00.000Z'); // Last Sunday
  });

  test('last2weeks returns the Sunday two weeks before last as start, and last Sunday as end', () => {
    const [start, end] = parseDurationValue('last2weeks');
    expect(start.toISOString()).toBe('2025-07-27T00:00:00.000Z'); // Two Sundays before last Sunday
    expect(end.toISOString()).toBe('2025-08-10T00:00:00.000Z'); // Last Sunday
  });

  test('lastMonth returns first day of previous month as start, and first day of current month as end', () => {
    const [start, end] = parseDurationValue('lastMonth');
    expect(start.toISOString()).toBe('2025-07-01T00:00:00.000Z'); // First day of previous month
    expect(end.toISOString()).toBe('2025-08-01T00:00:00.000Z'); // First day of current month
  });

  test('default returns allTime', () => {
    const [start, end] = parseDurationValue('anythingElse');
    expect(start.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(end.toISOString()).toBe(fixedDate.toISOString());
  });
});
