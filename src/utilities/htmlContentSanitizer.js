const sanitizeHtml = require('sanitize-html');

// Please refer to https://www.npmjs.com/package/sanitize-html?activeTab=readme for more information.

// eslint-disable-next-line import/prefer-default-export
const cleanHtml = (dirty) =>
  sanitizeHtml(dirty, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
  });

module.exports = {
  cleanHtml,
};
