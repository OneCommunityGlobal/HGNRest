const sanitizeHtml = require('sanitize-html');
const cheerio = require('cheerio');

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
  const decodedText = cheerio.load(`<body>${sanitizedText}</body>`)('body').text();

  return decodedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
};

module.exports = {
  cleanHtml,
  stripHtml,
};
