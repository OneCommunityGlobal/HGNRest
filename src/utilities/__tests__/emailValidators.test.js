const { getEmailDomainError } = require('../emailValidators');

describe('getEmailDomainError', () => {
  it.each([
    'ada@example.com',
    'ada@company.co',
    'ada@mail.cm',
    'ada@startup.io',
    'ada@uni.ac.uk',
    'Ada@Example.COM',
    '  ada@example.org  ',
    'ada@例子.中国',
  ])('accepts %s', (email) => {
    expect(getEmailDomainError(email)).toBe('');
  });

  it.each([
    ['rabstu@gmail.con', '.con'],
    ['ada@yahoo.cmo', '.cmo'],
    ['ada@outlook.comm', '.comm'],
    ['ada@company.c0m', '.c0m'],
  ])('rejects %s because %s is not a real TLD', (email, ending) => {
    expect(getEmailDomainError(email)).toBe(
      `"${ending}" isn't a valid email domain ending. Check for a typo.`,
    );
  });

  it.each(['', 'ada', 'ada@gmail', 'ada @gmail.com', 'ada@gmail.com.', null, undefined])(
    'rejects malformed input %p',
    (email) => {
      expect(getEmailDomainError(email)).toBe('Please enter a valid email address.');
    },
  );

  it('rejects hidden zero-width characters (they pass the format check and break duplicate detection)', () => {
    ['ada@hotmail.com\u200B', 'a\u2060da@gmail.com', '\uFEFFada@gmail.com'].forEach((email) => {
      expect(getEmailDomainError(email)).toBe(
        'This email has a hidden character in it. Please retype it.',
      );
    });
  });

  it('rejects addresses longer than 254 characters', () => {
    expect(getEmailDomainError(`ada@${'a'.repeat(250)}.com`)).toBe(
      'Please enter a valid email address.',
    );
    expect(getEmailDomainError(`a@${'a'.repeat(248)}.com`)).toBe('');
  });

  it('rejects a huge input fast, before the format check (a slow check would stall the API)', () => {
    const huge = `a@${'.'.repeat(1000000)}@`;
    const started = Date.now();
    expect(getEmailDomainError(huge)).toBe('Please enter a valid email address.');
    expect(Date.now() - started).toBeLessThan(50);
  });
});
