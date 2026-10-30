const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// C0/C1 controls (incl. CR/LF, NUL, DEL) plus the Unicode line/paragraph separators.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

/** Escape a value for safe interpolation into HTML text or a quoted attribute. */
function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Remove control characters (incl. CR/LF) and Unicode line/paragraph separators so a value
 * can be used in a single-line header such as an email subject.
 */
function stripControlChars(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(CONTROL_CHARS, '');
}

module.exports = { escapeHtml, stripControlChars };
