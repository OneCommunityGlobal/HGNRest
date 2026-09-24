const sanitizeHtml = require('sanitize-html');
const cheerio = require('cheerio');

// Please refer to https://www.npmjs.com/package/sanitize-html?activeTab=readme for more information.
// eslint-disable-next-line import/prefer-default-export

const cleanHtml = (dirty) =>
  sanitizeHtml(dirty, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
  });

const PLAIN_TEXT_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {},
};
const decodeHtmlEntities = (text) => cheerio.load(`<body>${text}</body>`)('body').text();
const escapePotentialHtmlStart = (text) => text.replace(/<(?=\/|[a-z!?\d])/gi, '&lt;');

const stripHtml = (dirty) => {
  if (dirty === null || dirty === undefined) return '';

  const textWithLineBreaks = String(dirty)
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|blockquote)\s*>/gi, '\n');
  const sanitizedText = sanitizeHtml(textWithLineBreaks, PLAIN_TEXT_OPTIONS);
  const decodedText = decodeHtmlEntities(sanitizedText);
  // Decode a single entity layer for readable text, but keep every possible
  // HTML start escaped so it cannot become markup in a future HTML sink.
  const safeText = escapePotentialHtmlStart(decodedText);

  return safeText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
};

module.exports = {
  cleanHtml,
  stripHtml,
};
