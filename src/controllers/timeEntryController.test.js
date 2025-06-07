const { formatSeconds, isGeneralTimeEntry } = require('./timeEntryController');

describe('formatSeconds', () => {
  test('formats 3661 seconds as [1, 1]', () => {
    expect(formatSeconds(3661)).toEqual(['1', '1']); // 1 hour 1 min
  });

  test.skip('formats 59 seconds as [0, 59]', () => {
    expect(formatSeconds(59)).toEqual(['0', '59']); // 0 hour 59 min
  });
});

describe('isGeneralTimeEntry', () => {
  test('returns true for undefined', () => {
    expect(isGeneralTimeEntry(undefined)).toBe(true);
  });

  test('returns false for non-default value', () => {
    expect(isGeneralTimeEntry('meeting')).toBe(false);
  });
});

