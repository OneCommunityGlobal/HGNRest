const {
  getApplicantNameError,
  normalizeApplicantName,
  MAX_APPLICANT_NAME_LENGTH,
} = require('../applicantName');

describe('normalizeApplicantName', () => {
  it('trims and collapses runs of whitespace', () => {
    expect(normalizeApplicantName('  Ada \t  Lovelace \n')).toBe('Ada Lovelace');
  });

  it('returns an empty string for non-strings', () => {
    expect(normalizeApplicantName(undefined)).toBe('');
    expect(normalizeApplicantName(null)).toBe('');
    expect(normalizeApplicantName({ name: 'Ada' })).toBe('');
    expect(normalizeApplicantName(['Ada'])).toBe('');
  });

  it('composes accents so decomposed and precomposed letters match', () => {
    expect(normalizeApplicantName('José')).toBe('José');
  });
});

describe('getApplicantNameError', () => {
  it.each([
    'Ada Lovelace',
    "Mary-Jane O'Neil",
    'José Álvarez',
    'Zoë Brontë',
    '李 小龍',
    'Владимир Набоков',
    'Al',
  ])('accepts %p', (name) => {
    expect(getApplicantNameError(name)).toBe('');
  });

  it('accepts a name written with combining accents', () => {
    expect(getApplicantNameError('Renée Dupont')).toBe('');
  });

  it.each([undefined, null, '', '   '])('requires a name (%p)', (name) => {
    expect(getApplicantNameError(name)).toBe('Name is required.');
  });

  it('rejects a non-string name', () => {
    expect(getApplicantNameError(['Ada', 'Lovelace'])).toBe('Name is required.');
  });

  it('rejects a single character', () => {
    expect(getApplicantNameError('A')).toBe('Name must be at least 2 characters.');
  });

  it('rejects names longer than two full form fields', () => {
    const longest = `${'a'.repeat(100)} ${'b'.repeat(100)}`;
    expect(longest).toHaveLength(MAX_APPLICANT_NAME_LENGTH);
    expect(getApplicantNameError(longest)).toBe('');
    expect(getApplicantNameError(`${longest}c`)).toBe(
      `Name must not exceed ${MAX_APPLICANT_NAME_LENGTH} characters.`,
    );
    expect(getApplicantNameError('a'.repeat(500))).toBe(
      `Name must not exceed ${MAX_APPLICANT_NAME_LENGTH} characters.`,
    );
  });

  it.each(['123', 'Ada 2', 'Ada@Lovelace', '#$%', 'Ada 😀', '<b>Ada</b>', 'Ada_Lovelace', 'Ada.'])(
    'rejects characters other than letters, spaces, hyphens and apostrophes (%p)',
    (name) => {
      expect(getApplicantNameError(name)).toBe(
        'Name may contain only letters, spaces, hyphens, and apostrophes.',
      );
    },
  );

  it('rejects names that contain no letters', () => {
    expect(getApplicantNameError("-- ''")).toBe(
      'Name may contain only letters, spaces, hyphens, and apostrophes.',
    );
  });

  it('rejects hidden zero-width characters', () => {
    expect(getApplicantNameError('Ada​Lovelace')).toBe(
      'Name may contain only letters, spaces, hyphens, and apostrophes.',
    );
  });
});
