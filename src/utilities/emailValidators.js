const { EMAIL_CONFIG } = require('../config/emailConfig');

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

  const splitEmails = arr.flatMap((e) => {
    if (typeof e !== 'string') return [];

    return e
      .split(',') // 🔥 KEY FIX
      .map((email) => email.trim())
      .filter(Boolean);
  });

  // dedupe case-insensitively
  const seen = new Set();
  return splitEmails.filter((e) => {
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

  const emails = input.flatMap((item) => {
    const value = typeof item === 'string' ? item : item?.email || '';

    return value
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email) => ({ email }));
  });

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
  const maxBytes = EMAIL_CONFIG.LIMITS.MAX_HTML_BYTES;
  const size = Buffer.byteLength(html || '', 'utf8');
  return size <= maxBytes;
}

/**
 * Normalize email field (to, cc, bcc) to array format.
 * Handles arrays, comma-separated strings, single strings, or null/undefined.
 * @param {string|string[]|null|undefined} field - Email field to normalize
 * @returns {string[]} Array of email addresses (empty array if input is invalid)
 */
function normalizeEmailField(field) {
  if (!field) {
    return [];
  }
  if (Array.isArray(field)) {
    return field.filter((e) => e && typeof e === 'string' && e.trim().length > 0);
  }
  // Handle comma-separated string
  return String(field)
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

module.exports = {
  isValidEmailAddress,
  normalizeRecipientsToArray,
  normalizeRecipientsToObjects,
  ensureHtmlWithinLimit,
  normalizeEmailField,
};
