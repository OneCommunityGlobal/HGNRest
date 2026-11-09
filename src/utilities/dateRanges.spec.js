const { getRangeFromQuery, getPreviousRange, getPreviousCustomRange } = require('./dateRanges');

const local = (year, month, day, hour = 0, minute = 0, second = 0, ms = 0) =>
  new Date(year, month - 1, day, hour, minute, second, ms);

const expectValidationError = (query, message) => {
  let error;
  try {
    getRangeFromQuery(query);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(Error);
  expect(error.status).toBe(422);
  expect(error.message).toBe(message);
};

describe('dateRanges', () => {
  afterEach(() => jest.useRealTimers());

  describe('getRangeFromQuery', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(local(2024, 2, 14, 12));
    });

    test.each([undefined, {}, { filter: '' }])('rejects a missing filter: %p', (query) => {
      expectValidationError(
        query,
        'Missing required query: filter=weekly|monthly|yearly|all (or provide startDate & endDate).',
      );
    });

    test.each(['daily', 'week', ' monthly ', 12, {}, ['weekly', 'monthly']])(
      'rejects unsupported filters: %p',
      (filter) => {
        expectValidationError({ filter }, 'Invalid filter. Allowed: weekly, monthly, yearly, all.');
      },
    );

    test.each(['weekly', 'WEEKLY', 'Weekly'])('finds Sunday-to-Saturday week for %s', (filter) => {
      expect(getRangeFromQuery({ filter })).toEqual({
        start: local(2024, 2, 11),
        end: local(2024, 2, 17, 23, 59, 59, 999),
        type: 'weekly',
      });
    });

    test('includes February 29 in a leap-year month', () => {
      expect(getRangeFromQuery({ filter: 'monthly' })).toEqual({
        start: local(2024, 2, 1),
        end: local(2024, 2, 29, 23, 59, 59, 999),
        type: 'monthly',
      });
    });

    test('includes both ends of the calendar year', () => {
      expect(getRangeFromQuery({ filter: 'YEARLY' })).toEqual({
        start: local(2024, 1, 1),
        end: local(2024, 12, 31, 23, 59, 59, 999),
        type: 'yearly',
      });
    });

    test('uses the documented fixed lower bound and current instant for all time', () => {
      expect(getRangeFromQuery({ filter: 'ALL' })).toEqual({
        start: new Date('2020-01-01T00:00:00.000Z'),
        end: local(2024, 2, 14, 12),
        type: 'all',
      });
    });

    test.each([
      [2023, 2, 28],
      [2024, 4, 30],
      [2024, 12, 31],
    ])('handles the calendar month containing %i-%i', (year, month, lastDay) => {
      jest.setSystemTime(local(year, month, 15, 12));
      expect(getRangeFromQuery({ filter: 'monthly' })).toEqual({
        start: local(year, month, 1),
        end: local(year, month, lastDay, 23, 59, 59, 999),
        type: 'monthly',
      });
    });

    test.each([
      [local(2024, 12, 31, 12), local(2024, 12, 29), local(2025, 1, 4, 23, 59, 59, 999)],
      [local(2024, 3, 10, 12), local(2024, 3, 10), local(2024, 3, 16, 23, 59, 59, 999)],
      [local(2024, 11, 3, 12), local(2024, 11, 3), local(2024, 11, 9, 23, 59, 59, 999)],
    ])('keeps local calendar boundaries across year/DST changes: %p', (now, start, end) => {
      jest.setSystemTime(now);
      expect(getRangeFromQuery({ filter: 'weekly' })).toEqual({ start, end, type: 'weekly' });
    });

    test('preserves explicit instants and gives custom dates precedence over filter', () => {
      const query = {
        filter: 'unsupported',
        startDate: '2024-03-10T01:30:00-08:00',
        endDate: '2024-03-10T03:30:00-07:00',
      };
      const before = { ...query };
      expect(getRangeFromQuery(query)).toEqual({
        start: new Date('2024-03-10T09:30:00.000Z'),
        end: new Date('2024-03-10T10:30:00.000Z'),
        type: 'custom',
      });
      expect(query).toEqual(before);
    });

    test('accepts date-only custom boundaries as UTC instants', () => {
      expect(getRangeFromQuery({ startDate: '2024-02-01', endDate: '2024-02-29' })).toEqual({
        start: new Date('2024-02-01T00:00:00.000Z'),
        end: new Date('2024-02-29T00:00:00.000Z'),
        type: 'custom',
      });
    });

    test.each([
      { startDate: '2024-02-01' },
      { endDate: '2024-02-29' },
      { startDate: 'bad-date', endDate: '2024-02-29' },
      { startDate: '2024-02-01', endDate: 'bad-date' },
      { startDate: ['2024-02-01'], endDate: '2024-02-29' },
      { startDate: '2024-02-01', endDate: { $gte: '2024-02-29' } },
      { startDate: 1706745600000, endDate: '2024-02-29' },
    ])('rejects malformed or incomplete custom dates: %p', (query) => {
      expectValidationError(query, 'startDate and endDate must be ISO date strings.');
    });
  });

  describe('getPreviousRange', () => {
    test.each([
      [
        local(2024, 1, 7),
        local(2024, 1, 13, 23, 59, 59, 999),
        local(2023, 12, 31),
        local(2024, 1, 6, 23, 59, 59, 999),
      ],
      [
        local(2024, 3, 17),
        local(2024, 3, 23, 23, 59, 59, 999),
        local(2024, 3, 10),
        local(2024, 3, 16, 23, 59, 59, 999),
      ],
      [
        local(2024, 11, 10),
        local(2024, 11, 16, 23, 59, 59, 999),
        local(2024, 11, 3),
        local(2024, 11, 9, 23, 59, 59, 999),
      ],
    ])(
      'finds previous calendar week across year/DST changes: %p',
      (start, end, previousStart, previousEnd) => {
        const range = { start, end, type: 'weekly' };
        const originalStart = start.getTime();
        const originalEnd = end.getTime();
        expect(getPreviousRange(range)).toEqual({
          start: previousStart,
          end: previousEnd,
          type: 'weekly',
        });
        expect(range.start.getTime()).toBe(originalStart);
        expect(range.end.getTime()).toBe(originalEnd);
      },
    );

    test('finds the previous month when crossing a year boundary', () => {
      expect(
        getPreviousRange({
          start: local(2025, 1, 1),
          end: local(2025, 1, 31, 23, 59, 59, 999),
          type: 'monthly',
        }),
      ).toEqual({
        start: local(2024, 12, 1),
        end: local(2024, 12, 31, 23, 59, 59, 999),
        type: 'monthly',
      });
    });

    test('finds the full preceding calendar year', () => {
      expect(
        getPreviousRange({
          start: local(2024, 1, 1),
          end: local(2024, 12, 31, 23, 59, 59, 999),
          type: 'yearly',
        }),
      ).toEqual({
        start: local(2023, 1, 1),
        end: local(2023, 12, 31, 23, 59, 59, 999),
        type: 'yearly',
      });
    });

    test.each([
      [2024, 3, 31, 2024, 2, 29],
      [2023, 3, 31, 2023, 2, 28],
      [2024, 5, 31, 2024, 4, 30],
    ])(
      'clamps a longer current month to a shorter previous month: %i-%i',
      (year, month, lastDay, previousYear, previousMonth, previousLastDay) => {
        const range = {
          start: local(year, month, 1),
          end: local(year, month, lastDay, 23, 59, 59, 999),
          type: 'monthly',
        };
        const original = { start: range.start.getTime(), end: range.end.getTime() };
        const previous = getPreviousRange(range);
        expect(previous).toEqual({
          start: local(previousYear, previousMonth, 1),
          end: local(previousYear, previousMonth, previousLastDay, 23, 59, 59, 999),
          type: 'monthly',
        });
        expect(range.start.getTime()).toBe(original.start);
        expect(range.end.getTime()).toBe(original.end);
        expect(previous.start).not.toBe(range.start);
        expect(previous.end).not.toBe(range.end);
      },
    );

    test.each([
      [2024, 2, 29, 2024, 1, 31],
      [2023, 2, 28, 2023, 1, 31],
      [2024, 4, 30, 2024, 3, 31],
      [2024, 9, 30, 2024, 8, 31],
    ])(
      'includes every day when the preceding month is longer: %i-%i',
      (year, month, lastDay, previousYear, previousMonth, previousLastDay) => {
        const range = {
          start: local(year, month, 1),
          end: local(year, month, lastDay, 23, 59, 59, 999),
          type: 'monthly',
        };
        const original = { start: range.start.getTime(), end: range.end.getTime() };
        const previous = getPreviousRange(range);
        expect(previous).toEqual({
          start: local(previousYear, previousMonth, 1),
          end: local(previousYear, previousMonth, previousLastDay, 23, 59, 59, 999),
          type: 'monthly',
        });
        expect(range.start.getTime()).toBe(original.start);
        expect(range.end.getTime()).toBe(original.end);
      },
    );

    test.each(['all', 'custom', 'unknown'])(
      'does not invent a calendar comparison for %s',
      (type) => {
        expect(getPreviousRange({ type })).toBeNull();
      },
    );
  });

  describe('getPreviousCustomRange', () => {
    test.each([undefined, null, {}, { type: 'weekly' }])(
      'returns null without a custom range: %p',
      (range) => {
        expect(getPreviousCustomRange(range)).toBeNull();
      },
    );

    test.each([
      ['2024-02-01T00:00:00Z', '2024-02-03T00:00:00Z'],
      ['2024-03-10T01:30:00-08:00', '2024-03-10T03:30:00-07:00'],
      ['2024-11-03T00:30:00-07:00', '2024-11-03T02:30:00-08:00'],
      ['2024-02-01T00:00:00.000Z', '2024-02-01T00:00:00.001Z'],
    ])('preserves elapsed duration and original dates: %s to %s', (startString, endString) => {
      const range = { start: new Date(startString), end: new Date(endString), type: 'custom' };
      const startMs = range.start.getTime();
      const endMs = range.end.getTime();
      const previous = getPreviousCustomRange(range);
      expect(previous.type).toBe('custom');
      expect(previous.end.getTime()).toBe(startMs);
      expect(previous.end.getTime() - previous.start.getTime()).toBe(endMs - startMs);
      expect(range.start.getTime()).toBe(startMs);
      expect(range.end.getTime()).toBe(endMs);
      expect(previous.start).not.toBe(range.start);
      expect(previous.end).not.toBe(range.end);
    });

    test.each([
      [new Date('2024-02-01'), new Date('2024-02-01')],
      [new Date('2024-02-03'), new Date('2024-02-01')],
      [new Date('invalid'), new Date('2024-02-01')],
      [new Date('2024-02-01'), new Date('invalid')],
    ])('returns null when elapsed duration is not positive: %p to %p', (start, end) => {
      expect(getPreviousCustomRange({ start, end, type: 'custom' })).toBeNull();
    });
  });
});
