// Server-side check for the applicant name on the public job application submit.
// Mirrors the Job Application form (validateName in JobApplicationForm.jsx): letters,
// spaces, hyphens and apostrophes, at least 2 characters. The form checks First and
// Last name separately (100 characters each) and sends them joined by one space, so
// the full name may be up to 201 characters.

const MIN_APPLICANT_NAME_LENGTH = 2;
const MAX_APPLICANT_NAME_LENGTH = 201;
// Letters plus combining marks (accents typed as a separate code point), spaces,
// hyphens and apostrophes. Must contain at least one letter.
const NAME_PATTERN = /^[\p{L}\p{M}\s'-]+$/u;
const HAS_LETTER = /\p{L}/u;

/**
 * Trim, collapse whitespace and compose accents (NFC).
 * @param {unknown} name
 * @returns {string} The cleaned name, or '' when the value is not a string
 */
function normalizeApplicantName(name) {
  if (typeof name !== 'string') return '';
  return name.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * @param {unknown} name - full applicant name ("First Last")
 * @returns {string} Error message, or '' when the name is acceptable
 */
function getApplicantNameError(name) {
  const cleaned = normalizeApplicantName(name);
  if (!cleaned) return 'Name is required.';
  // Length first, so the pattern never runs on a huge string
  if (cleaned.length > MAX_APPLICANT_NAME_LENGTH) {
    return `Name must not exceed ${MAX_APPLICANT_NAME_LENGTH} characters.`;
  }
  if (cleaned.length < MIN_APPLICANT_NAME_LENGTH) {
    return `Name must be at least ${MIN_APPLICANT_NAME_LENGTH} characters.`;
  }
  if (!NAME_PATTERN.test(cleaned) || !HAS_LETTER.test(cleaned)) {
    return 'Name may contain only letters, spaces, hyphens, and apostrophes.';
  }
  return '';
}

module.exports = {
  getApplicantNameError,
  normalizeApplicantName,
  MIN_APPLICANT_NAME_LENGTH,
  MAX_APPLICANT_NAME_LENGTH,
};
