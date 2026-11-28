const { escapeHtml, stripControlChars } = require('../escapeHtml');

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('turns a link into inert text', () => {
    expect(escapeHtml('<a href="https://evil.example">click</a>')).toBe(
      '&lt;a href=&quot;https://evil.example&quot;&gt;click&lt;/a&gt;',
    );
  });

  it('escapes ampersands first so entities are not double-decoded', () => {
    expect(escapeHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;');
  });

  it('leaves ordinary names unchanged', () => {
    expect(escapeHtml('Ada Lovelace')).toBe('Ada Lovelace');
    expect(escapeHtml('José Núñez-Ochoa')).toBe('José Núñez-Ochoa');
  });

  it('returns an empty string for null or undefined and stringifies other values', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('stripControlChars', () => {
  it('removes CR, LF and other control characters', () => {
    expect(stripControlChars('Dev\r\nBcc: victim@example.com')).toBe('DevBcc: victim@example.com');
    expect(stripControlChars('a\u0000b\tc\u007fd')).toBe('abcd');
  });

  it('removes Unicode line and paragraph separators', () => {
    expect(stripControlChars('a\u2028b\u2029c\u0085d')).toBe('abcd');
  });

  it('leaves normal text unchanged', () => {
    expect(stripControlChars('Application Received — Software Developer')).toBe(
      'Application Received — Software Developer',
    );
  });

  it('returns an empty string for null or undefined', () => {
    expect(stripControlChars(null)).toBe('');
    expect(stripControlChars(undefined)).toBe('');
  });
});
