const { domainToASCII } = require('url');
const { EMAIL_CONFIG } = require('../config/emailConfig');
const { IANA_TLDS } = require('./ianaTlds');

const MAX_EMAIL_LENGTH = 254;
// Zero-width and word-joiner characters ride along with copy-paste and are invisible on screen
const HIDDEN_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/;

/**
 * Validate email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmailAddress(email) {
  if (!email || typeof email !== 'string') return false;
  // Check length first: the regex slows down badly on huge input (a public-route stall)
  if (email.trim().length > MAX_EMAIL_LENGTH) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Check that an email address is well formed and ends in a real top-level domain,
 * so typos like "name@gmail.con" are caught (the basic format check accepts them).
 * @param {string} email - Email address to validate
 * @returns {string} Error message, or '' when the address is acceptable
 */
function getEmailDomainError(email) {
  if (!isValidEmailAddress(email)) return 'Please enter a valid email address.';
  if (HIDDEN_CHARACTERS.test(email)) {
    return 'This email has a hidden character in it. Please retype it.';
  }
  const domain = email.trim().split('@').pop();
  if (domain.endsWith('.')) return 'Please enter a valid email address.';
  const tld = domain.split('.').pop();
  // IANA lists internationalized TLDs in punycode (e.g. "xn--fiqs8s")
  const asciiTld = (domainToASCII(domain).split('.').pop() || tld).toLowerCase();
  if (!IANA_TLDS.has(asciiTld)) {
    return `".${tld}" isn't a valid email domain ending. Check for a typo.`;
  }
  return '';
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
  getEmailDomainError,
  normalizeRecipientsToArray,
  normalizeRecipientsToObjects,
  ensureHtmlWithinLimit,
  normalizeEmailField,
};
