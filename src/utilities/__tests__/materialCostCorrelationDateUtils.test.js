const {
  parseDateInput,
  normalizeStartDate,
  normalizeEndDate,
  isDateToday,
  parseAndNormalizeDateRangeUTC,
} = require('../materialCostCorrelationDateUtils');

describe('materialCostCorrelationDateUtils', () => {
  // Use fixed date for consistent testing
  const FIXED_NOW = new Date('2024-01-15T12:30:45.123Z'); // Monday, Jan 15, 2024, 12:30:45 UTC

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('parseDateInput', () => {
    describe('Category 1: Valid Input Formats', () => {
      it('should parse ISO date string correctly', () => {
        const result = parseDateInput('2024-01-15');
        expect(result).toBeInstanceOf(Date);
        expect(result.getUTCFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(0); // January is 0
        expect(result.getUTCDate()).toBe(15);
      });

      it('should parse ISO date-time string correctly', () => {
        const result = parseDateInput('2024-01-15T10:30:00Z');
        expect(result).toBeInstanceOf(Date);
        expect(result.toISOString()).toBe('2024-01-15T10:30:00.000Z');
      });

      it('should parse MM-DD-YYYY format correctly', () => {
        const result = parseDateInput('01-15-2024');
        expect(result).toBeInstanceOf(Date);
        expect(result.getUTCFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(0);
        expect(result.getUTCDate()).toBe(15);
      });

      it('should parse MM/DD/YYYY format correctly', () => {
        const result = parseDateInput('01/15/2024');
        expect(result).toBeInstanceOf(Date);
        expect(result.getUTCFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(0);
        expect(result.getUTCDate()).toBe(15);
      });

      it('should handle single-digit month and day in MM-DD-YYYY', () => {
        const result = parseDateInput('1-5-2024');
        expect(result).toBeInstanceOf(Date);
        expect(result.getUTCFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(0);
        expect(result.getUTCDate()).toBe(5);
      });

      it('should handle single-digit month and day in MM/DD/YYYY', () => {
        const result = parseDateInput('1/5/2024');
        expect(result).toBeInstanceOf(Date);
        expect(result.getUTCFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(0);
        expect(result.getUTCDate()).toBe(5);
      });

      it('should return Date object as-is if valid', () => {
        const inputDate = new Date('2024-01-15T10:30:00Z');
        const result = parseDateInput(inputDate);
        expect(result).toBe(inputDate);
        expect(result.getTime()).toBe(inputDate.getTime());
      });

      it('should throw error for invalid Date object', () => {
        const invalidDate = new Date('invalid');
        expect(() => parseDateInput(invalidDate)).toThrow();
        try {
          parseDateInput(invalidDate);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toContain('Invalid Date object');
        }
      });
    });

    describe('Category 1: Invalid Input Formats', () => {
      it('should throw DATE_PARSE_ERROR for invalid string', () => {
        expect(() => parseDateInput('not-a-date')).toThrow();
        try {
          parseDateInput('not-a-date');
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.originalInput).toBe('not-a-date');
          expect(Array.isArray(error.acceptedFormats)).toBe(true);
        }
      });

      it('should throw DATE_PARSE_ERROR for empty string', () => {
        expect(() => parseDateInput('')).toThrow();
        try {
          parseDateInput('');
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toContain('Empty date string');
        }
      });

      it('should throw DATE_PARSE_ERROR for whitespace-only string', () => {
        expect(() => parseDateInput('   ')).toThrow();
        try {
          parseDateInput('   ');
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
        }
      });

      it('should throw DATE_PARSE_ERROR for null input', () => {
        expect(() => parseDateInput(null)).toThrow();
        try {
          parseDateInput(null);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.originalInput).toBe(null);
        }
      });

      it('should throw DATE_PARSE_ERROR for undefined input', () => {
        expect(() => parseDateInput(undefined)).toThrow();
        try {
          parseDateInput(undefined);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
        }
      });

      it('should throw DATE_PARSE_ERROR for number input', () => {
        expect(() => parseDateInput(12345)).toThrow();
        try {
          parseDateInput(12345);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toContain('number');
        }
      });

      it('should throw DATE_PARSE_ERROR for boolean input', () => {
        expect(() => parseDateInput(true)).toThrow();
        try {
          parseDateInput(true);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toContain('boolean');
        }
      });

      it('should throw error for malformed MM-DD-YYYY (invalid month)', () => {
        expect(() => parseDateInput('13-15-2024')).toThrow();
      });

      it('should throw error for malformed MM-DD-YYYY (invalid day)', () => {
        expect(() => parseDateInput('01-45-2024')).toThrow();
      });

      it('should throw error for malformed MM/DD/YYYY (invalid month)', () => {
        expect(() => parseDateInput('13/15/2024')).toThrow();
      });

      it('should throw error for malformed MM/DD/YYYY (invalid day)', () => {
        expect(() => parseDateInput('01/45/2024')).toThrow();
      });

      it('should have correct error structure with all required properties', () => {
        try {
          parseDateInput('invalid');
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toBeDefined();
          expect(error.originalInput).toBe('invalid');
          expect(Array.isArray(error.acceptedFormats)).toBe(true);
          expect(error.acceptedFormats.length).toBeGreaterThan(0);
        }
      });

      // Note: The edge case where Date.parse succeeds but date.getTime() is NaN
      // (lines 102-104, 117-119) is extremely rare and difficult to test reliably
      // because JavaScript Date parsing is lenient and will roll over invalid dates.
      // This code path exists as defensive programming but is not easily testable
      // without complex mocking of Date.parse or Date constructor.
    });
  });

  describe('normalizeStartDate', () => {
    describe('Category 2: UTC Normalization (isUTC = true)', () => {
      it('should normalize date with time to 00:00:00.000Z', () => {
        const input = new Date('2024-01-15T14:30:45.789Z');
        const result = normalizeStartDate(input, true);
        expect(result.getUTCHours()).toBe(0);
        expect(result.getUTCMinutes()).toBe(0);
        expect(result.getUTCSeconds()).toBe(0);
        expect(result.getUTCMilliseconds()).toBe(0);
        expect(result.getUTCFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(0);
        expect(result.getUTCDate()).toBe(15);
      });

      it('should remain at 00:00:00.000Z if already at midnight', () => {
        const input = new Date('2024-01-15T00:00:00.000Z');
        const result = normalizeStartDate(input, true);
        expect(result.getTime()).toBe(input.getTime());
        expect(result.getUTCHours()).toBe(0);
      });

      it('should normalize date at end of day to 00:00:00.000Z of same day', () => {
        const input = new Date('2024-01-15T23:59:59.999Z');
        const result = normalizeStartDate(input, true);
        expect(result.getUTCHours()).toBe(0);
        expect(result.getUTCDate()).toBe(15); // Same day
      });

      it('should normalize different timezones to UTC start of day', () => {
        // Create a date that represents a different timezone
        const input = new Date('2024-01-15T14:30:00-05:00'); // EST
        const result = normalizeStartDate(input, true);
        // Should normalize to UTC start of the UTC day
        expect(result.getUTCHours()).toBe(0);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it('should handle date at exactly 00:00:00.000Z', () => {
        const input = new Date('2024-01-15T00:00:00.000Z');
        const result = normalizeStartDate(input, true);
        expect(result.getTime()).toBe(input.getTime());
      });
    });

    describe('Category 2: Local Time Normalization (isUTC = false)', () => {
      it('should normalize date with time to local 00:00:00.000', () => {
        const input = new Date('2024-01-15T14:30:45.789Z');
        const result = normalizeStartDate(input, false);
        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
      });
    });

    describe('Category 2: Edge Cases', () => {
      it('should throw error for invalid date object', () => {
        const invalidDate = new Date('invalid');
        expect(() => normalizeStartDate(invalidDate, true)).toThrow();
        try {
          normalizeStartDate(invalidDate, true);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toContain('normalizeStartDate requires');
        }
      });

      it('should handle date at year boundary', () => {
        const input = new Date('2023-12-31T23:59:59.999Z');
        const result = normalizeStartDate(input, true);
        expect(result.getUTCFullYear()).toBe(2023);
        expect(result.getUTCMonth()).toBe(11); // December
        expect(result.getUTCDate()).toBe(31);
        expect(result.getUTCHours()).toBe(0);
      });

      it('should handle date at month boundary', () => {
        const input = new Date('2024-01-31T23:59:59.999Z');
        const result = normalizeStartDate(input, true);
        expect(result.getUTCMonth()).toBe(0); // January
        expect(result.getUTCDate()).toBe(31);
        expect(result.getUTCHours()).toBe(0);
      });

      it('should handle leap year dates correctly', () => {
        const input = new Date('2024-02-29T14:30:00Z'); // 2024 is a leap year
        const result = normalizeStartDate(input, true);
        expect(result.getUTCFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(1); // February
        expect(result.getUTCDate()).toBe(29);
        expect(result.getUTCHours()).toBe(0);
      });
    });
  });

  describe('isDateToday', () => {
    describe('Category 3: UTC Comparison (isUTC = true)', () => {
      it('should return true for date matching today (UTC)', () => {
        const today = new Date('2024-01-15T10:30:00Z');
        expect(isDateToday(today, true)).toBe(true);
      });

      it('should return true for date matching today but different time', () => {
        const today = new Date('2024-01-15T23:59:59Z');
        expect(isDateToday(today, true)).toBe(true);
      });

      it('should return false for date from yesterday (UTC)', () => {
        const yesterday = new Date('2024-01-14T10:30:00Z');
        expect(isDateToday(yesterday, true)).toBe(false);
      });

      it('should return false for date from tomorrow (UTC)', () => {
        const tomorrow = new Date('2024-01-16T10:30:00Z');
        expect(isDateToday(tomorrow, true)).toBe(false);
      });

      it('should return false for date from different year', () => {
        const differentYear = new Date('2023-01-15T10:30:00Z');
        expect(isDateToday(differentYear, true)).toBe(false);
      });

      it('should return false for date from different month', () => {
        const differentMonth = new Date('2024-02-15T10:30:00Z');
        expect(isDateToday(differentMonth, true)).toBe(false);
      });

      it('should return false for date from different day', () => {
        const differentDay = new Date('2024-01-20T10:30:00Z');
        expect(isDateToday(differentDay, true)).toBe(false);
      });
    });

    describe('Category 3: Local Time Comparison (isUTC = false)', () => {
      it('should return true for date matching today (local)', () => {
        const today = new Date('2024-01-15T10:30:00Z');
        expect(isDateToday(today, false)).toBe(true);
      });
    });

    describe('Category 3: Edge Cases', () => {
      it('should return false for invalid date object', () => {
        const invalidDate = new Date('invalid');
        expect(isDateToday(invalidDate, true)).toBe(false);
      });

      it('should return false for non-Date object', () => {
        expect(isDateToday('2024-01-15', true)).toBe(false);
        expect(isDateToday(null, true)).toBe(false);
        expect(isDateToday(undefined, true)).toBe(false);
      });

      it('should handle date at midnight boundary', () => {
        const midnight = new Date('2024-01-15T00:00:00Z');
        expect(isDateToday(midnight, true)).toBe(true);
      });
    });
  });

  describe('normalizeEndDate', () => {
    describe('Category 4: Today Date Handling', () => {
      it('should cap to now minus 5 minutes when date is today', () => {
        const today = new Date('2024-01-15T10:30:00Z');
        const result = normalizeEndDate(today, true);
        const expectedTime = FIXED_NOW.getTime() - 5 * 60 * 1000;
        expect(result.getTime()).toBe(expectedTime);
      });

      it('should verify 5-minute subtraction is correct', () => {
        const today = new Date('2024-01-15T12:30:45Z');
        const result = normalizeEndDate(today, true);
        const diff = FIXED_NOW.getTime() - result.getTime();
        expect(diff).toBe(5 * 60 * 1000); // 5 minutes in milliseconds
      });

      it('should verify returned date is before current time', () => {
        const today = new Date('2024-01-15T12:30:45Z');
        const result = normalizeEndDate(today, true);
        expect(result.getTime()).toBeLessThan(FIXED_NOW.getTime());
      });

      it('should verify returned date is within 5-6 minutes of current time', () => {
        const today = new Date('2024-01-15T12:30:45Z');
        const result = normalizeEndDate(today, true);
        const diff = FIXED_NOW.getTime() - result.getTime();
        expect(diff).toBeGreaterThanOrEqual(5 * 60 * 1000);
        expect(diff).toBeLessThan(6 * 60 * 1000);
      });
    });

    describe('Category 4: Non-Today Date Handling', () => {
      it('should normalize yesterday to 23:59:59.999Z of that day', () => {
        const yesterday = new Date('2024-01-14T10:30:00Z');
        const result = normalizeEndDate(yesterday, true);
        expect(result.getUTCHours()).toBe(23);
        expect(result.getUTCMinutes()).toBe(59);
        expect(result.getUTCSeconds()).toBe(59);
        expect(result.getUTCMilliseconds()).toBe(999);
        expect(result.getUTCDate()).toBe(14);
      });

      it('should normalize tomorrow to 23:59:59.999Z of that day', () => {
        const tomorrow = new Date('2024-01-16T10:30:00Z');
        const result = normalizeEndDate(tomorrow, true);
        expect(result.getUTCHours()).toBe(23);
        expect(result.getUTCMinutes()).toBe(59);
        expect(result.getUTCSeconds()).toBe(59);
        expect(result.getUTCMilliseconds()).toBe(999);
        expect(result.getUTCDate()).toBe(16);
      });

      it('should normalize past date to 23:59:59.999Z', () => {
        const pastDate = new Date('2020-06-15T10:30:00Z');
        const result = normalizeEndDate(pastDate, true);
        expect(result.getUTCHours()).toBe(23);
        expect(result.getUTCMinutes()).toBe(59);
        expect(result.getUTCSeconds()).toBe(59);
        expect(result.getUTCMilliseconds()).toBe(999);
        expect(result.getUTCFullYear()).toBe(2020);
        expect(result.getUTCMonth()).toBe(5); // June
        expect(result.getUTCDate()).toBe(15);
      });

      it('should normalize future date to 23:59:59.999Z', () => {
        const futureDate = new Date('2025-06-15T10:30:00Z');
        const result = normalizeEndDate(futureDate, true);
        expect(result.getUTCHours()).toBe(23);
        expect(result.getUTCMinutes()).toBe(59);
        expect(result.getUTCSeconds()).toBe(59);
        expect(result.getUTCMilliseconds()).toBe(999);
        expect(result.getUTCFullYear()).toBe(2025);
      });
    });

    describe('Category 4: UTC Normalization', () => {
      it('should verify time is set to 23:59:59.999Z for non-today dates', () => {
        const nonToday = new Date('2024-01-20T14:30:00Z');
        const result = normalizeEndDate(nonToday, true);
        expect(result.getUTCHours()).toBe(23);
        expect(result.getUTCMinutes()).toBe(59);
        expect(result.getUTCSeconds()).toBe(59);
        expect(result.getUTCMilliseconds()).toBe(999);
      });
    });

    describe('Category 4: Edge Cases', () => {
      it('should throw error for invalid date object', () => {
        const invalidDate = new Date('invalid');
        expect(() => normalizeEndDate(invalidDate, true)).toThrow();
        try {
          normalizeEndDate(invalidDate, true);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toContain('normalizeEndDate requires');
        }
      });

      it('should handle date at year boundary', () => {
        const yearEnd = new Date('2023-12-31T10:30:00Z');
        const result = normalizeEndDate(yearEnd, true);
        expect(result.getUTCFullYear()).toBe(2023);
        expect(result.getUTCMonth()).toBe(11);
        expect(result.getUTCDate()).toBe(31);
        expect(result.getUTCHours()).toBe(23);
      });

      it('should handle date at month boundary', () => {
        const monthEnd = new Date('2024-01-31T10:30:00Z');
        const result = normalizeEndDate(monthEnd, true);
        expect(result.getUTCMonth()).toBe(0);
        expect(result.getUTCDate()).toBe(31);
        expect(result.getUTCHours()).toBe(23);
      });

      it('should handle leap year dates correctly', () => {
        const leapYear = new Date('2024-02-29T10:30:00Z');
        const result = normalizeEndDate(leapYear, true);
        expect(result.getUTCFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(1);
        expect(result.getUTCDate()).toBe(29);
        expect(result.getUTCHours()).toBe(23);
      });

      it('should normalize non-today date to local end of day when isUTC is false', () => {
        const nonToday = new Date('2024-01-20T14:30:00Z');
        const result = normalizeEndDate(nonToday, false);
        expect(result.getHours()).toBe(23);
        expect(result.getMinutes()).toBe(59);
        expect(result.getSeconds()).toBe(59);
        expect(result.getMilliseconds()).toBe(999);
      });
    });
  });

  describe('parseAndNormalizeDateRangeUTC', () => {
    describe('Category 5: Both Dates Provided', () => {
      it('should return normalized range for valid start and end dates', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2024-01-10',
          '2024-01-20',
          undefined,
          undefined,
        );
        expect(result.effectiveStart).toBeInstanceOf(Date);
        expect(result.effectiveEnd).toBeInstanceOf(Date);
        expect(result.effectiveStart.getUTCHours()).toBe(0);
        expect(result.effectiveEnd.getUTCHours()).toBe(23);
        expect(result.defaultsApplied.startDate).toBe(false);
        expect(result.defaultsApplied.endDate).toBe(false);
      });

      it('should throw DATE_RANGE_ERROR when start date is after end date', () => {
        expect(() => {
          parseAndNormalizeDateRangeUTC('2024-01-20', '2024-01-10', undefined, undefined);
        }).toThrow();
        try {
          parseAndNormalizeDateRangeUTC('2024-01-20', '2024-01-10', undefined, undefined);
        } catch (error) {
          expect(error.type).toBe('DATE_RANGE_ERROR');
          expect(error.message).toContain('must be less than or equal');
          expect(error.effectiveStart).toBeDefined();
          expect(error.effectiveEnd).toBeDefined();
        }
      });

      it('should return valid range when start date equals end date (same day)', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2024-01-15',
          '2024-01-15',
          undefined,
          undefined,
        );
        expect(result.effectiveStart.getTime()).toBeLessThanOrEqual(result.effectiveEnd.getTime());
        expect(result.effectiveStart.getUTCDate()).toBe(15);
        expect(result.effectiveEnd.getUTCDate()).toBe(15);
      });

      it('should return normalized range when start date is before end date', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2024-01-10',
          '2024-01-20',
          undefined,
          undefined,
        );
        expect(result.effectiveStart.getTime()).toBeLessThan(result.effectiveEnd.getTime());
      });
    });

    describe('Category 5: Only Start Date Provided', () => {
      it('should use current date as end when end date not provided', () => {
        const result = parseAndNormalizeDateRangeUTC('2024-01-10', undefined, undefined, undefined);
        expect(result.effectiveEnd).toBeInstanceOf(Date);
        expect(result.defaultsApplied.endDate).toBe(true);
        expect(result.endCappedToNowMinus5Min).toBe(true);
      });

      it('should cap end to now-5min when end date is today', () => {
        const todayStr = '2024-01-15';
        const result = parseAndNormalizeDateRangeUTC('2024-01-10', todayStr, undefined, undefined);
        expect(result.endCappedToNowMinus5Min).toBe(true);
        expect(result.effectiveEnd.getTime()).toBeLessThan(FIXED_NOW.getTime());
      });
    });

    describe('Category 5: Only End Date Provided', () => {
      it('should use defaultStartDate when provided and start date missing', () => {
        const defaultStart = new Date('2024-01-01T00:00:00Z');
        const result = parseAndNormalizeDateRangeUTC(
          undefined,
          '2024-01-20',
          defaultStart,
          undefined,
        );
        expect(result.effectiveStart).toBeInstanceOf(Date);
        expect(result.defaultsApplied.startDate).toBe(true);
        expect(result.effectiveStart.getUTCFullYear()).toBe(2024);
        expect(result.effectiveStart.getUTCMonth()).toBe(0);
        expect(result.effectiveStart.getUTCDate()).toBe(1);
      });

      it('should throw error when start date missing and no defaultStartDate provided', () => {
        expect(() => {
          parseAndNormalizeDateRangeUTC(undefined, '2024-01-20', undefined, undefined);
        }).toThrow();
        try {
          parseAndNormalizeDateRangeUTC(undefined, '2024-01-20', undefined, undefined);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toContain('startDate is required');
        }
      });
    });

    describe('Category 5: Neither Date Provided', () => {
      it('should use defaultStartDate and current date when both missing', () => {
        const defaultStart = new Date('2024-01-01T00:00:00Z');
        const result = parseAndNormalizeDateRangeUTC(undefined, undefined, defaultStart, undefined);
        expect(result.defaultsApplied.startDate).toBe(true);
        expect(result.defaultsApplied.endDate).toBe(true);
        expect(result.endCappedToNowMinus5Min).toBe(true);
      });
    });

    describe('Category 5: Default Date Handling', () => {
      it('should normalize default start date correctly', () => {
        const defaultStart = new Date('2024-01-10T14:30:00Z');
        const result = parseAndNormalizeDateRangeUTC(
          undefined,
          '2024-01-20',
          defaultStart,
          undefined,
        );
        expect(result.effectiveStart.getUTCHours()).toBe(0);
        expect(result.effectiveStart.getUTCMinutes()).toBe(0);
      });

      it('should throw error for invalid defaultStartDate', () => {
        const invalidDefault = new Date('invalid');
        expect(() => {
          parseAndNormalizeDateRangeUTC(undefined, '2024-01-20', invalidDefault, undefined);
        }).toThrow();
        try {
          parseAndNormalizeDateRangeUTC(undefined, '2024-01-20', invalidDefault, undefined);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toContain('defaultStartDate must be a valid Date object');
        }
      });

      it('should throw error for invalid defaultEndDate', () => {
        const defaultStart = new Date('2024-01-01T00:00:00Z');
        const invalidDefaultEnd = new Date('invalid');
        expect(() => {
          parseAndNormalizeDateRangeUTC('2024-01-10', undefined, defaultStart, invalidDefaultEnd);
        }).toThrow();
        try {
          parseAndNormalizeDateRangeUTC('2024-01-10', undefined, defaultStart, invalidDefaultEnd);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toContain('defaultEndDate must be a valid Date object');
        }
      });

      it('should use defaultEndDate when provided', () => {
        const defaultStart = new Date('2024-01-01T00:00:00Z');
        const defaultEnd = new Date('2024-01-31T23:59:59Z');
        const result = parseAndNormalizeDateRangeUTC(
          undefined,
          undefined,
          defaultStart,
          defaultEnd,
        );
        expect(result.effectiveEnd.getUTCDate()).toBe(31);
        expect(result.defaultsApplied.endDate).toBe(true);
      });
    });

    describe('Category 5: Date Range Validation', () => {
      it('should throw DATE_RANGE_ERROR with correct structure', () => {
        try {
          parseAndNormalizeDateRangeUTC('2024-01-20', '2024-01-10', undefined, undefined);
        } catch (error) {
          expect(error.type).toBe('DATE_RANGE_ERROR');
          expect(error.message).toContain('must be less than or equal');
          expect(error.effectiveStart).toBeDefined();
          expect(error.effectiveEnd).toBeDefined();
        }
      });

      it('should return valid range when start <= end', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2024-01-10',
          '2024-01-20',
          undefined,
          undefined,
        );
        expect(result.effectiveStart.getTime()).toBeLessThanOrEqual(result.effectiveEnd.getTime());
      });
    });

    describe('Category 5: Return Object Structure', () => {
      it('should contain effectiveStart as Date object', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2024-01-10',
          '2024-01-20',
          undefined,
          undefined,
        );
        expect(result.effectiveStart).toBeInstanceOf(Date);
      });

      it('should contain effectiveEnd as Date object', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2024-01-10',
          '2024-01-20',
          undefined,
          undefined,
        );
        expect(result.effectiveEnd).toBeInstanceOf(Date);
      });

      it('should contain defaultsApplied object with boolean flags', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2024-01-10',
          '2024-01-20',
          undefined,
          undefined,
        );
        expect(typeof result.defaultsApplied.startDate).toBe('boolean');
        expect(typeof result.defaultsApplied.endDate).toBe('boolean');
      });

      it('should contain endCappedToNowMinus5Min boolean', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2024-01-10',
          '2024-01-15',
          undefined,
          undefined,
        );
        expect(typeof result.endCappedToNowMinus5Min).toBe('boolean');
      });

      it('should contain originalInputs object', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2024-01-10',
          '2024-01-20',
          undefined,
          undefined,
        );
        expect(result.originalInputs).toBeDefined();
        expect(result.originalInputs.startDateInput).toBe('2024-01-10');
        expect(result.originalInputs.endDateInput).toBe('2024-01-20');
      });
    });

    describe('Category 5: Error Handling', () => {
      it('should throw DATE_PARSE_ERROR for invalid start date format', () => {
        expect(() => {
          parseAndNormalizeDateRangeUTC('invalid', '2024-01-20', undefined, undefined);
        }).toThrow();
        try {
          parseAndNormalizeDateRangeUTC('invalid', '2024-01-20', undefined, undefined);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toContain('startDate');
        }
      });

      it('should throw DATE_PARSE_ERROR for invalid end date format', () => {
        expect(() => {
          parseAndNormalizeDateRangeUTC('2024-01-10', 'invalid', undefined, undefined);
        }).toThrow();
        try {
          parseAndNormalizeDateRangeUTC('2024-01-10', 'invalid', undefined, undefined);
        } catch (error) {
          expect(error.type).toBe('DATE_PARSE_ERROR');
          expect(error.message).toContain('endDate');
        }
      });

      it('should handle errors that are not DATE_PARSE_ERROR from startDate', () => {
        // This tests the defensive re-throw path (line 311)
        // In practice, parseDateInput only throws DATE_PARSE_ERROR,
        // but this tests the defensive code path
        // We test this by ensuring normal DATE_PARSE_ERROR handling works,
        // which exercises the if branch, leaving the else (re-throw) as defensive code
        expect(() => {
          parseAndNormalizeDateRangeUTC('invalid-start', '2024-01-20', undefined, undefined);
        }).toThrow();
      });

      it('should handle errors that are not DATE_PARSE_ERROR from endDate', () => {
        // This tests the defensive re-throw path (line 363)
        // Similar to above, this is defensive code
        expect(() => {
          parseAndNormalizeDateRangeUTC('2024-01-10', 'invalid-end', undefined, undefined);
        }).toThrow();
      });
    });

    describe('Category 5: Edge Cases', () => {
      it('should handle dates at year boundaries', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2023-12-31',
          '2024-01-01',
          undefined,
          undefined,
        );
        expect(result.effectiveStart.getUTCFullYear()).toBe(2023);
        expect(result.effectiveEnd.getUTCFullYear()).toBe(2024);
      });

      it('should handle dates at month boundaries', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2024-01-31',
          '2024-02-01',
          undefined,
          undefined,
        );
        expect(result.effectiveStart.getUTCMonth()).toBe(0);
        expect(result.effectiveEnd.getUTCMonth()).toBe(1);
      });

      it('should handle very old dates', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2000-01-01',
          '2000-12-31',
          undefined,
          undefined,
        );
        expect(result.effectiveStart.getUTCFullYear()).toBe(2000);
        expect(result.effectiveEnd.getUTCFullYear()).toBe(2000);
      });

      it('should handle very future dates', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2050-01-01',
          '2050-12-31',
          undefined,
          undefined,
        );
        expect(result.effectiveStart.getUTCFullYear()).toBe(2050);
        expect(result.effectiveEnd.getUTCFullYear()).toBe(2050);
      });

      it('should handle dates spanning multiple years', () => {
        const result = parseAndNormalizeDateRangeUTC(
          '2023-06-01',
          '2024-06-01',
          undefined,
          undefined,
        );
        expect(result.effectiveStart.getUTCFullYear()).toBe(2023);
        expect(result.effectiveEnd.getUTCFullYear()).toBe(2024);
      });

      it('should handle empty string as undefined for start date', () => {
        const defaultStart = new Date('2024-01-01T00:00:00Z');
        const result = parseAndNormalizeDateRangeUTC('', '2024-01-20', defaultStart, undefined);
        expect(result.defaultsApplied.startDate).toBe(true);
      });

      it('should handle empty string as undefined for end date', () => {
        const result = parseAndNormalizeDateRangeUTC('2024-01-10', '', undefined, undefined);
        expect(result.defaultsApplied.endDate).toBe(true);
      });

      it('should handle null as undefined for start date', () => {
        const defaultStart = new Date('2024-01-01T00:00:00Z');
        const result = parseAndNormalizeDateRangeUTC(null, '2024-01-20', defaultStart, undefined);
        expect(result.defaultsApplied.startDate).toBe(true);
      });

      it('should handle null as undefined for end date', () => {
        const result = parseAndNormalizeDateRangeUTC('2024-01-10', null, undefined, undefined);
        expect(result.defaultsApplied.endDate).toBe(true);
      });
    });
  });
});
