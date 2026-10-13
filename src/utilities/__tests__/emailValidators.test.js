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

  it.each(['', 'ada', 'ada@gmail', 'ada @gmail.com', null, undefined])(
    'rejects malformed input %p',
    (email) => {
      expect(getEmailDomainError(email)).toBe('Please enter a valid email address.');
    },
  );
});
