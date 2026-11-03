const {
  PR_RATINGS,
  RATING_VALUES,
  normalisePrNumber,
  extractPrNumbersFromSummary,
  isValidRating,
  groupEntriesByWeek,
} = require('./prEntryHelper');

describe('PR_RATINGS', () => {
  test('is exactly the five options the spec lists, in order', () => {
    expect(RATING_VALUES).toEqual([
      'Did not review',
      'Needs more details',
      'Good',
      'Exceptional',
      'No Image',
    ]);
  });

  test('carries the display treatment the spec specifies for each', () => {
    const byValue = Object.fromEntries(PR_RATINGS.map((r) => [r.value, r.display]));
    expect(byValue['Did not review']).toBe('red');
    expect(byValue['Needs more details']).toBe('blue');
    expect(byValue.Good).toBe('black');
    expect(byValue.Exceptional).toBe('black-yellow-highlight');
    expect(byValue['No Image']).toBe('strikethrough');
  });
});

describe('normalisePrNumber', () => {
  test('accepts the plain shapes people type', () => {
    expect(normalisePrNumber('1234')).toBe('1234');
    expect(normalisePrNumber('#1234')).toBe('1234');
    expect(normalisePrNumber('PR 1234')).toBe('1234');
    expect(normalisePrNumber('PR#1234')).toBe('1234');
    expect(normalisePrNumber(1234)).toBe('1234');
  });

  test('keeps the repo prefix the synced data uses', () => {
    expect(normalisePrNumber('FE-1234')).toBe('FE-1234');
    expect(normalisePrNumber('fe 1234')).toBe('FE-1234');
    expect(normalisePrNumber('BE#567')).toBe('BE-567');
  });

  test('reads a GitHub pull URL', () => {
    expect(normalisePrNumber('https://github.com/OneCommunityGlobal/HGNRest/pull/2284')).toBe(
      '2284',
    );
  });

  test('rejects things that are not PR numbers rather than guessing', () => {
    ['', '   ', 'abc', '#', 'PR', '12345678', null, undefined, {}, -5, 0].forEach((value) => {
      expect(normalisePrNumber(value)).toBeNull();
    });
  });
});

describe('extractPrNumbersFromSummary', () => {
  test('finds PR numbers written the common ways', () => {
    const summary = 'This week I reviewed PR 1234, #567 and https://github.com/o/r/pull/890.';
    expect(extractPrNumbersFromSummary(summary)).toEqual(
      expect.arrayContaining(['1234', '567', '890']),
    );
  });

  test('strips HTML, since summaries are stored as markup', () => {
    expect(extractPrNumbersFromSummary('<p>Reviewed <b>#1234</b></p>')).toEqual(['1234']);
  });

  test('de-duplicates a PR mentioned more than once', () => {
    const found = extractPrNumbersFromSummary('#1234 and again PR 1234 and /pull/1234');
    expect(found.filter((n) => n === '1234')).toHaveLength(1);
  });

  test('keeps the FE and BE prefixes apart from bare numbers', () => {
    expect(extractPrNumbersFromSummary('Did FE-1234 and BE#567')).toEqual(
      expect.arrayContaining(['FE-1234', 'BE-567']),
    );
  });

  test('ignores bare numbers in prose, which are usually hours or dates', () => {
    // Deliberately conservative. Without a marker these are far more likely to
    // be something other than a PR.
    expect(extractPrNumbersFromSummary('I worked 12 hours across 3 days on 2026-08-21')).toEqual(
      [],
    );
  });

  test('returns nothing for empty or missing input rather than throwing', () => {
    expect(extractPrNumbersFromSummary('')).toEqual([]);
    expect(extractPrNumbersFromSummary(null)).toEqual([]);
    expect(extractPrNumbersFromSummary(undefined)).toEqual([]);
    expect(extractPrNumbersFromSummary('No PRs this week, was on leave.')).toEqual([]);
  });
});

describe('isValidRating', () => {
  test('accepts each of the five and null', () => {
    RATING_VALUES.forEach((value) => expect(isValidRating(value)).toBe(true));
    expect(isValidRating(null)).toBe(true);
  });

  test('rejects anything else, including near misses', () => {
    ['Sufficient', 'Needs Changes', 'good', '', undefined, 3].forEach((value) => {
      expect(isValidRating(value)).toBe(false);
    });
  });

  test('rejects the analytics service buckets, which are a different vocabulary', () => {
    // fetchGithubReviews grades GitHub review states into four buckets. Two of
    // its names look close enough to be mixed up with these by accident.
    expect(isValidRating('Sufficient')).toBe(false);
    expect(isValidRating('Did Not Review')).toBe(false); // note the capital N and R
  });
});

describe('groupEntriesByWeek', () => {
  const entry = (year, week, prNumber) => ({ year, week, prNumber });

  test('groups by week, newest week first', () => {
    const grouped = groupEntriesByWeek([
      entry(2026, 31, 'a'),
      entry(2026, 33, 'b'),
      entry(2026, 32, 'c'),
    ]);

    expect(grouped.map((g) => g.week)).toEqual([33, 32, 31]);
  });

  test('sorts across a year boundary rather than by week number alone', () => {
    const grouped = groupEntriesByWeek([entry(2026, 1, 'a'), entry(2025, 52, 'b')]);
    expect(grouped.map((g) => [g.year, g.week])).toEqual([
      [2026, 1],
      [2025, 52],
    ]);
  });

  test('keeps entries within a week in the order they arrived', () => {
    const grouped = groupEntriesByWeek([
      entry(2026, 33, 'first'),
      entry(2026, 33, 'second'),
      entry(2026, 33, 'third'),
    ]);

    expect(grouped[0].prs.map((p) => p.prNumber)).toEqual(['first', 'second', 'third']);
  });

  test('handles empty and missing input', () => {
    expect(groupEntriesByWeek([])).toEqual([]);
    expect(groupEntriesByWeek(null)).toEqual([]);
  });
});
