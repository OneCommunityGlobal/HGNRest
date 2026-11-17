const { parseYmdUtc, parseDateFlexibleUTC } = require('./bmDateUtils');

describe('parseYmdUtc', () => {
  it.each([
    ['2024-02-29', '2024-02-29T00:00:00.000Z'],
    ['2026-03-08', '2026-03-08T00:00:00.000Z'],
    ['2026-11-01', '2026-11-01T00:00:00.000Z'],
    ['2026-12-31', '2026-12-31T00:00:00.000Z'],
  ])('parses %s as UTC midnight', (input, expected) => {
    expect(parseYmdUtc(input)).toEqual(new Date(expected));
  });

  it.each([undefined, null, '', '2026-3-08', '03/08/2026', '2026-03-08T00:00:00Z'])(
    'returns null for non-YYYY-MM-DD input %p',
    (input) => {
      expect(parseYmdUtc(input)).toBeNull();
    },
  );
});

describe('parseDateFlexibleUTC', () => {
  it.each([
    ['2026-03-08', '2026-03-08T00:00:00.000Z'],
    ['2026-03-08T12:34:56.789Z', '2026-03-08T12:34:56.789Z'],
    ['2026-03-08T23:30:00-07:00', '2026-03-09T06:30:00.000Z'],
    ['2026-11-01T00:30:00+02:00', '2026-10-31T22:30:00.000Z'],
  ])('parses %s to the expected UTC instant', (input, expected) => {
    expect(parseDateFlexibleUTC(input)).toEqual(new Date(expected));
  });

  it.each([undefined, null, '', 'not a date', '2026-03-08T25:00:00Z'])(
    'returns null for missing or unparseable input %p',
    (input) => {
      expect(parseDateFlexibleUTC(input)).toBeNull();
    },
  );
});
