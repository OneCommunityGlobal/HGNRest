const sanitizeHtml = require('sanitize-html');

// Please refer to https://www.npmjs.com/package/sanitize-html?activeTab=readme for more information.
// eslint-disable-next-line import/prefer-default-export

const cleanHtml = (dirty) =>
  sanitizeHtml(dirty, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
  });

const stripHtml = (dirty) => {
  if (dirty === null || dirty === undefined) return '';

  const textWithLineBreaks = String(dirty)
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|blockquote)\s*>/gi, '\n');
  const sanitizedText = sanitizeHtml(textWithLineBreaks, {
    allowedTags: [],
    allowedAttributes: {},
  });
  // Do not decode entities after sanitizing. Decoding `&lt;img ...&gt;` here would
  // recreate markup after it was made safe, allowing it to be stored as HTML.
  return sanitizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
};

module.exports = {
  cleanHtml,
  stripHtml,
};
