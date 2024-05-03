const sanitizeHtml = require('sanitize-html');

const cleanHtml = (dirty) =>
  sanitizeHtml(dirty, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
  });

module.exports = { cleanHtml };
