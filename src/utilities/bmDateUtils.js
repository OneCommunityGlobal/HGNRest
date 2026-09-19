/**
 * Shared date utility functions for BM Dashboard controllers
 */

/**
 * Parse date string in YYYY-MM-DD format to UTC Date object
 */
const parseYmdUtc = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, 0, 0, 0, 0));
};

/**
 * Parse date string flexibly - tries YYYY-MM-DD first, then ISO 8601
 */
const parseDateFlexibleUTC = (s) => {
  const d1 = parseYmdUtc(s);
  if (d1) return d1;
  if (!s) return null;
  const d2 = new Date(s);
  return Number.isNaN(d2.getTime()) ? null : d2;
};

module.exports = {
  parseYmdUtc,
  parseDateFlexibleUTC,
};
