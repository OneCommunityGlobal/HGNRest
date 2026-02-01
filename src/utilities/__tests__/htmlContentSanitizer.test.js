const { cleanHtml } = require('../htmlContentSanitizer');

describe('htmlContentSanitizer', () => {
  it('should remove disallowed tags by default', () => {
    const dirtyHtml = '<div><script>alert("xss")</script><h1>Hello</h1></div>';
    const clean = cleanHtml(dirtyHtml);
    expect(clean).toBe('<div><h1>Hello</h1></div>');
  });

  it('should allow img tags', () => {
    const dirtyHtml = '<div><img src="test.jpg" onload="alert(\'xss\')"></div>';
    const clean = cleanHtml(dirtyHtml);
    // sanitize-html outputs self-closing tags and removes dangerous attributes
    expect(clean).toBe('<div><img src="test.jpg" /></div>');
  });

  it('should remove disallowed attributes from allowed tags', () => {
    const dirtyHtml = '<p style="color:red;" onclick="alert(\'xss\')">Test</p>';
    const clean = cleanHtml(dirtyHtml);
    expect(clean).toBe('<p>Test</p>');
  });

  it('should handle empty string gracefully', () => {
    const dirtyHtml = '';
    const clean = cleanHtml(dirtyHtml);
    expect(clean).toBe('');
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

  it('should allow specific attributes for allowed tags if configured (default allows src for img)', () => {
    const dirtyHtml = '<img src="image.png" alt="description">';
    const clean = cleanHtml(dirtyHtml);
    // sanitize-html by default allows src and alt attributes, outputs self-closing tags
    expect(clean).toBe('<img src="image.png" alt="description" />');
  });

  it('should not modify clean HTML', () => {
    const cleanHtmlString = '<div><p>Hello World</p></div>';
    const clean = cleanHtml(cleanHtmlString);
    expect(clean).toBe(cleanHtmlString);
  });
});
