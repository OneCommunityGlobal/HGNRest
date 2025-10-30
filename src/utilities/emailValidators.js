const cheerio = require('cheerio');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');

/**
 * Validate email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmailAddress(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Normalize recipients input to array of email strings
 * Handles both array and single value, removes duplicates (case-insensitive)
 * @param {string|Array<string>} input - Recipient(s) to normalize
 * @returns {Array<string>} Array of unique email strings
 */
function normalizeRecipientsToArray(input) {
  const arr = Array.isArray(input) ? input : [input];
  const trimmed = arr
    .map((e) => (typeof e === 'string' ? e.trim() : ''))
    .filter((e) => e.length > 0);
  // Dedupe case-insensitively
  const seen = new Set();
  return trimmed.filter((e) => {
    const key = e.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Normalize recipients input to array of { email } objects
 * Used by EmailBatchService for creating EmailBatch records
 * @param {Array<string|Object>} input - Recipients array
 * @returns {Array<{email: string}>} Array of recipient objects
 */
function normalizeRecipientsToObjects(input) {
  if (!Array.isArray(input)) return [];
  const emails = input
    .filter((item) => {
      if (typeof item === 'string') {
        return item.trim().length > 0;
      }
      return item && typeof item.email === 'string' && item.email.trim().length > 0;
    })
    .map((item) => ({
      email: typeof item === 'string' ? item.trim() : item.email.trim(),
    }));

  // Dedupe case-insensitively
  const seen = new Set();
  return emails.filter((obj) => {
    const key = obj.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Validate HTML content size is within limit
 * @param {string} html - HTML content to validate
 * @returns {boolean} True if within limit
 */
function ensureHtmlWithinLimit(html) {
  const maxBytes = EMAIL_JOB_CONFIG.LIMITS.MAX_HTML_BYTES;
  const size = Buffer.byteLength(html || '', 'utf8');
  return size <= maxBytes;
}

/**
 * Validate HTML content does not contain base64-encoded media (data URIs)
 * Only URLs are allowed for media to keep emails light
 * @param {string} html - HTML content to validate
 * @returns {{isValid: boolean, errors: Array<string>}} Validation result
 */
function validateHtmlMedia(html) {
  const $ = cheerio.load(html);
  const invalidMedia = [];

  // Check for base64 images in img tags
  $('img').each((i, img) => {
    const src = $(img).attr('src');
    if (src && src.startsWith('data:image')) {
      invalidMedia.push(`Image ${i + 1}: base64-encoded image detected (use URL instead)`);
    }
  });

  // Check for base64 images in CSS background-image
  const htmlString = $.html();
  const base64ImageRegex = /data:image\/[^;]+;base64,[^\s"')]+/gi;
  const backgroundMatches = htmlString.match(base64ImageRegex);
  if (backgroundMatches) {
    invalidMedia.push(
      `${backgroundMatches.length} base64-encoded background image(s) detected (use URL instead)`,
    );
  }

  // Check for base64 audio/video
  const base64MediaRegex = /data:(audio|video)\/[^;]+;base64,[^\s"')]+/gi;
  const mediaMatches = htmlString.match(base64MediaRegex);
  if (mediaMatches) {
    invalidMedia.push(
      `${mediaMatches.length} base64-encoded media file(s) detected (use URL instead)`,
    );
  }

  return {
    isValid: invalidMedia.length === 0,
    errors: invalidMedia,
  };
}

module.exports = {
  isValidEmailAddress,
  normalizeRecipientsToArray,
  normalizeRecipientsToObjects,
  ensureHtmlWithinLimit,
  validateHtmlMedia,
};
