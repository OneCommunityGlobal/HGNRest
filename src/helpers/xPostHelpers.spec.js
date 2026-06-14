const { validateContent, ValidationError, X_MAX_CONTENT_LENGTH } = require('./xPostHelpers');

describe('xPostHelpers validateContent', () => {
  it('exports a 280-character X content limit', () => {
    expect(X_MAX_CONTENT_LENGTH).toBe(280);
  });

  it('accepts content at exactly 280 characters', () => {
    expect(() => validateContent('a'.repeat(280))).not.toThrow();
  });

  it('accepts a normal short string', () => {
    expect(() => validateContent('Hello from the X auto-poster!')).not.toThrow();
  });

  it('rejects content at 281 characters with a 400 ValidationError', () => {
    let thrown;
    try {
      validateContent('a'.repeat(281));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect(thrown.status).toBe(400);
    expect(thrown.message).toBe(`Content exceeds ${X_MAX_CONTENT_LENGTH} characters`);
  });

  it('rejects content well over the limit', () => {
    expect(() => validateContent('a'.repeat(1000))).toThrow(/exceeds/);
  });

  describe('missing or non-string content (current contract)', () => {
    it.each([
      ['empty string', ''],
      ['undefined', undefined],
      ['null', null],
      ['number', 42],
    ])('rejects %s with a 400 "content is required" error', (_label, value) => {
      let thrown;
      try {
        validateContent(value);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(ValidationError);
      expect(thrown.status).toBe(400);
      expect(thrown.message).toBe('content is required');
    });
  });

  it('honors custom messages and max length', () => {
    expect(() => validateContent('abcd', 'req', 'too long', 3)).toThrow('too long');
    expect(() => validateContent('', 'req', 'too long', 3)).toThrow('req');
  });
});
