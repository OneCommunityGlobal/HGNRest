const {
  DEFAULT_REVIEWER_GROUPS,
  normaliseLetter,
  groupingLetter,
  isReviewerInGroup,
  validateRange,
  rangeWarnings,
  slugifyGroupKey,
} = require('./reviewerGroupHelper');

const ALL_GROUP = { key: 'all', label: 'All Members', rangeStart: null, rangeEnd: null };
const A_TO_N = { key: '95xx', label: '95XXPRT Members', rangeStart: 'A', rangeEnd: 'N' };
const O_TO_Z = { key: '97xx', label: '97XXPRT Members', rangeStart: 'O', rangeEnd: 'Z' };

describe('DEFAULT_REVIEWER_GROUPS', () => {
  test('seeds the three groups the spec names, in dropdown order', () => {
    expect(DEFAULT_REVIEWER_GROUPS.map((g) => g.key)).toEqual(['all', '95xx', '97xx']);
    expect(DEFAULT_REVIEWER_GROUPS.map((g) => g.label)).toEqual([
      'All Members',
      '95XXPRT Members',
      '97XXPRT Members',
    ]);
  });

  test('splits the alphabet A-N and O-Z, leaving All Members unranged', () => {
    const [all, first, second] = DEFAULT_REVIEWER_GROUPS;
    expect(all.rangeStart).toBeNull();
    expect(all.rangeEnd).toBeNull();
    expect([first.rangeStart, first.rangeEnd]).toEqual(['A', 'N']);
    expect([second.rangeStart, second.rangeEnd]).toEqual(['O', 'Z']);
  });

  test('only All Members is locked against editing', () => {
    expect(DEFAULT_REVIEWER_GROUPS.filter((g) => g.editable === false).map((g) => g.key)).toEqual([
      'all',
    ]);
  });
});

describe('normaliseLetter', () => {
  test('uppercases a single letter', () => {
    expect(normaliseLetter('a')).toBe('A');
    expect(normaliseLetter('N')).toBe('N');
  });

  test('trims surrounding whitespace, since the range arrives from a text input', () => {
    expect(normaliseLetter('  n  ')).toBe('N');
  });

  test.each(['AB', '', '1', '-', null, undefined, 5, {}])(
    'rejects %p as a range letter',
    (value) => {
      expect(normaliseLetter(value)).toBeNull();
    },
  );
});

describe('groupingLetter', () => {
  test('takes the first letter of the first name, as the spec names the groups', () => {
    expect(groupingLetter({ firstName: 'Jane', lastName: 'Doe' })).toBe('J');
  });

  test('is case insensitive', () => {
    expect(groupingLetter({ firstName: 'jane', lastName: 'doe' })).toBe('J');
  });

  test('strips accents so Alvarez and Álvarez land in the same group', () => {
    expect(groupingLetter({ firstName: 'Álvaro', lastName: 'Ruiz' })).toBe('A');
    expect(groupingLetter({ firstName: 'Ödegaard', lastName: 'Ruiz' })).toBe('O');
  });

  test('falls back to the last name when the first name is missing or blank', () => {
    expect(groupingLetter({ firstName: '', lastName: 'Prince' })).toBe('P');
    expect(groupingLetter({ lastName: 'Prince' })).toBe('P');
  });

  test('returns null when neither name yields an A-Z letter', () => {
    expect(groupingLetter({ firstName: '', lastName: '' })).toBeNull();
    expect(groupingLetter({ firstName: '123', lastName: '456' })).toBeNull();
    expect(groupingLetter({})).toBeNull();
  });
});

describe('isReviewerInGroup', () => {
  test('All Members takes everybody, including names with no usable letter', () => {
    expect(isReviewerInGroup({ firstName: 'Jane', lastName: 'Doe' }, ALL_GROUP)).toBe(true);
    expect(isReviewerInGroup({ firstName: '', lastName: '' }, ALL_GROUP)).toBe(true);
  });

  test('matches a reviewer whose letter sits inside the range', () => {
    expect(isReviewerInGroup({ firstName: 'Jane', lastName: 'Doe' }, A_TO_N)).toBe(true);
    expect(isReviewerInGroup({ firstName: 'Jane', lastName: 'Doe' }, O_TO_Z)).toBe(false);
  });

  test('the first name decides the group, not the last name', () => {
    expect(isReviewerInGroup({ firstName: 'Ana', lastName: 'Zhang' }, A_TO_N)).toBe(true);
    expect(isReviewerInGroup({ firstName: 'Ana', lastName: 'Zhang' }, O_TO_Z)).toBe(false);
  });

  test('the range is inclusive at both ends', () => {
    expect(isReviewerInGroup({ firstName: 'Adams', lastName: 'A' }, A_TO_N)).toBe(true);
    expect(isReviewerInGroup({ firstName: 'Nolan', lastName: 'N' }, A_TO_N)).toBe(true);
    expect(isReviewerInGroup({ firstName: 'Olsen', lastName: 'O' }, A_TO_N)).toBe(false);
  });

  test('a reviewer with no usable letter falls into no lettered group', () => {
    expect(isReviewerInGroup({ firstName: '123', lastName: '456' }, A_TO_N)).toBe(false);
    expect(isReviewerInGroup({ firstName: '123', lastName: '456' }, O_TO_Z)).toBe(false);
  });

  test('the two default ranges partition every reviewer exactly once', () => {
    const reviewers = ['Adams', 'Doe', 'Nolan', 'Olsen', 'Zhang'].map((firstName) => ({
      firstName,
      lastName: 'Test',
    }));

    reviewers.forEach((reviewer) => {
      const matches = [A_TO_N, O_TO_Z].filter((group) => isReviewerInGroup(reviewer, group));
      expect(matches).toHaveLength(1);
    });
  });
});

describe('validateRange', () => {
  test('accepts a well formed range and returns the normalised letters', () => {
    expect(validateRange({ rangeStart: 'a', rangeEnd: 'n' })).toEqual({
      valid: true,
      rangeStart: 'A',
      rangeEnd: 'N',
      error: null,
    });
  });

  test('accepts a single letter range', () => {
    expect(validateRange({ rangeStart: 'Q', rangeEnd: 'Q' }).valid).toBe(true);
  });

  test('rejects a range that ends before it starts', () => {
    const result = validateRange({ rangeStart: 'N', rangeEnd: 'A' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/before/i);
  });

  test.each([
    ['AB', 'N'],
    ['A', ''],
    ['1', 'N'],
    [null, 'N'],
    ['A', undefined],
  ])('rejects the range %p to %p', (rangeStart, rangeEnd) => {
    expect(validateRange({ rangeStart, rangeEnd }).valid).toBe(false);
  });
});

describe('rangeWarnings', () => {
  test('is silent when the lettered groups tile the alphabet exactly', () => {
    expect(rangeWarnings([ALL_GROUP, A_TO_N, O_TO_Z])).toEqual([]);
  });

  test('reports letters that two groups both claim', () => {
    const widened = { ...A_TO_N, rangeEnd: 'P' };
    const warnings = rangeWarnings([ALL_GROUP, widened, O_TO_Z]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('95XXPRT Members');
    expect(warnings[0]).toContain('97XXPRT Members');
    expect(warnings[0]).toContain('O-P');
  });

  test('reports letters no group covers', () => {
    const narrowed = { ...A_TO_N, rangeEnd: 'K' };
    const warnings = rangeWarnings([ALL_GROUP, narrowed, O_TO_Z]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('L-N');
  });

  test('describes a single uncovered letter without a range dash', () => {
    const narrowed = { ...A_TO_N, rangeEnd: 'M' };
    const warnings = rangeWarnings([ALL_GROUP, narrowed, O_TO_Z]);

    expect(warnings[0]).toContain('N');
    expect(warnings[0]).not.toContain('N-N');
  });

  test('ignores the unranged All Members group rather than treating it as a gap', () => {
    expect(rangeWarnings([ALL_GROUP])).toEqual(['No group covers A-Z']);
  });
});

describe('slugifyGroupKey', () => {
  test('builds a url safe key from the label', () => {
    expect(slugifyGroupKey('99XXPRT Members', [])).toBe('99xxprt-members');
  });

  test('drops punctuation and collapses whitespace', () => {
    expect(slugifyGroupKey('  Weekend   Crew (new)! ', [])).toBe('weekend-crew-new');
  });

  test('suffixes a number rather than colliding with an existing key', () => {
    expect(slugifyGroupKey('All Members', ['all-members'])).toBe('all-members-2');
    expect(slugifyGroupKey('All Members', ['all-members', 'all-members-2'])).toBe('all-members-3');
  });

  test('returns null for a label with nothing sluggable in it', () => {
    expect(slugifyGroupKey('!!!', [])).toBeNull();
    expect(slugifyGroupKey('', [])).toBeNull();
  });
});
