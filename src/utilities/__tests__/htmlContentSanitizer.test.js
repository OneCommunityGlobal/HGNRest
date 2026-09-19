const { cleanHtml, stripHtml } = require('../htmlContentSanitizer');

describe('htmlContentSanitizer', () => {
  it('should sanitize HTML content', () => {
    const dirty = '<script>alert("xss")</script><p>Safe content</p>';
    const cleaned = cleanHtml(dirty);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).toContain('<p>Safe content</p>');
  });

  it('should allow img tags', () => {
    const dirty = '<img src="test.jpg" alt="test">';
    const cleaned = cleanHtml(dirty);
    expect(cleaned).toContain('<img');
  });

  it('should preserve allowed HTML tags', () => {
    const dirty = '<p>Paragraph</p><div>Div</div><span>Span</span>';
    const cleaned = cleanHtml(dirty);
    expect(cleaned).toContain('<p>');
    expect(cleaned).toContain('<div>');
    expect(cleaned).toContain('<span>');
  });

  it('should remove script tags', () => {
    const dirty = '<script>malicious code</script><p>Safe</p>';
    const cleaned = cleanHtml(dirty);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).toContain('<p>Safe</p>');
  });

  it('should handle empty strings', () => {
    expect(cleanHtml('')).toBe('');
  });

  it('should handle plain text', () => {
    const text = 'Just plain text';
    expect(cleanHtml(text)).toBe(text);
  });

  it('should handle null input gracefully', () => {
    const dirtyHtml = null;
    const clean = cleanHtml(dirtyHtml);
    expect(clean).toBe('');
  });

  it('should handle undefined input gracefully', () => {
    const dirtyHtml = undefined;
    const clean = cleanHtml(dirtyHtml);
    expect(clean).toBe('');
  });

  it('should remove disallowed attributes from allowed tags', () => {
    const dirtyHtml = '<p style="color:red;" onclick="alert(\'xss\')">Test</p>';
    const clean = cleanHtml(dirtyHtml);
    expect(clean).toBe('<p>Test</p>');
  });
});

describe('stripHtml', () => {
  it('removes markup while preserving readable block boundaries', () => {
    const dirty = '<p>Hello <strong>world</strong></p><ul><li>One</li><li>Two</li></ul>';

    expect(stripHtml(dirty)).toBe('Hello world\nOne\nTwo');
  });

  it('removes script content without recreating encoded markup', () => {
    const dirty = '<script>alert("xss")</script><p>Safe &amp; sound; 2 &lt; 3</p>';

    expect(stripHtml(dirty)).toBe('Safe &amp; sound; 2 &lt; 3');
  });

  it('keeps encoded tags as text instead of recreating them as markup', () => {
    expect(stripHtml('&lt;img src=x onerror=alert(1)&gt;')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(stripHtml('&#60;img src=x onerror=alert(1)&#62;')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(stripHtml('&lt;/p&gt;&lt;img src=x onerror=alert(1)&gt;')).toBe(
      '&lt;/p&gt;&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(stripHtml('&amp;lt;img&amp;gt;')).toBe('&amp;lt;img&amp;gt;');
  });

  it('handles plain, empty, and missing values', () => {
    expect(stripHtml('Just plain text')).toBe('Just plain text');
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
  });
});
