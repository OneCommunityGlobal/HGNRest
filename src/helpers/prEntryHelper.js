/**
 * "+ Add New" PR entries and their ratings (doc item #23, spec item 5).
 *
 * The spec asks for a per-week list of the PRs a reviewer reviewed, each one
 * rated from a fixed set of options that change how it is displayed. It also
 * asks for the list to populate itself from the reviewer's weekly summary
 * submission, with manual addition on top.
 *
 * Everything here is pure so the parsing and validation are testable without a
 * database.
 */

/**
 * The five rating options, exactly as the spec lists them, with the display
 * treatment it specifies for each.
 *
 * Served to the frontend rather than hardcoded there, so the dropdown and the
 * validation cannot drift apart. `display` is advisory: the backend does not
 * render anything, it just carries the spec's intent to whoever does.
 *
 * Note these are NOT the same four buckets that
 * `services/analytics/fetchGithubReviews.js` uses (Exceptional, Sufficient,
 * Needs Changes, Did Not Review). That service grades GitHub review states;
 * this is a human rating the quality of a review. They overlap but are not
 * interchangeable, and merging them was explicitly left as a question.
 */
const PR_RATINGS = [
  { value: 'Did not review', display: 'red', sortOrder: 0 },
  { value: 'Needs more details', display: 'blue', sortOrder: 1 },
  { value: 'Good', display: 'black', sortOrder: 2 },
  { value: 'Exceptional', display: 'black-yellow-highlight', sortOrder: 3 },
  { value: 'No Image', display: 'strikethrough', sortOrder: 4 },
];

const RATING_VALUES = PR_RATINGS.map((rating) => rating.value);

/** Where an entry came from. Kept so a parsed entry can be told from a typed one. */
const PR_ENTRY_SOURCES = ['manual', 'weeklySummary'];

/**
 * Normalise a PR number as typed into something storable.
 *
 * The synced PR data uses a "FE-1234" / "BE-1234" prefix, and people write PR
 * numbers half a dozen ways, so this accepts the common shapes and keeps the
 * repo prefix when one is given:
 *
 *   "1234", "#1234", "PR 1234", "PR#1234"      -> "1234"
 *   "FE-1234", "fe 1234", "FE#1234"            -> "FE-1234"
 *   "https://github.com/org/repo/pull/1234"    -> "1234"
 *
 * PR numbers start at 1, so zero in any of these shapes ("0", "000", "FE-0")
 * is refused. Leading zeros are dropped so "0123" and "123" are the same PR.
 *
 * @returns {string|null} the normalised number, or null if unreadable
 */
function normalisePrNumber(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return String(value);
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // null for zero, otherwise the number without leading zeros.
  const positive = (digits) => (Number(digits) > 0 ? String(Number(digits)) : null);

  const fromUrl = trimmed.match(/\/pull\/(\d+)/i);
  if (fromUrl) return positive(fromUrl[1]);

  const prefixed = trimmed.match(/^(FE|BE)\s*[-#]?\s*(\d{1,6})$/i);
  if (prefixed) {
    const number = positive(prefixed[2]);
    return number && `${prefixed[1].toUpperCase()}-${number}`;
  }

  const plain = trimmed.match(/^(?:PRs?\s*)?#?\s*(\d{1,6})$/i);
  if (plain) return positive(plain[1]);

  return null;
}

/**
 * Pull PR numbers out of a weekly summary submission.
 *
 * The spec says "+ Add New" should populate itself from the person's weekly
 * summary, which is a free text field people write prose into, so this is
 * best effort by nature.
 *
 * **This has never been run against a real summary.** Not one profile on dev
 * has any weekly summary text at all, so there is no sample of how people
 * actually write PR numbers, and the patterns below are assumptions. The
 * synced `pullRequestReview` data is a far better source and is already in the
 * database; that is open question 2 to Jae. Treat anything this returns as a
 * suggestion for a human to confirm, which is why entries created this way are
 * stored with source "weeklySummary" rather than silently mixed in with typed
 * ones.
 *
 * Deliberately conservative: it wants an explicit PR marker (a #, a "PR", or a
 * GitHub pull URL). A bare number in prose is far more likely to be an hour
 * count or a date than a PR.
 *
 * @param {string} summary the raw weekly summary, which may contain HTML
 * @returns {string[]} normalised PR numbers, de-duplicated, in order of appearance
 */
function extractPrNumbersFromSummary(summary) {
  if (typeof summary !== 'string' || !summary.trim()) return [];

  // Strip tags but keep the text, since summaries are stored as HTML.
  const text = summary.replace(/<[^>]+>/g, ' ');

  const found = [];
  const seen = new Set();
  const add = (candidate) => {
    const normalised = normalisePrNumber(candidate);
    if (normalised && !seen.has(normalised)) {
      seen.add(normalised);
      found.push(normalised);
    }
  };

  const patterns = [
    /https?:\/\/\S*?\/pull\/(\d+)/gi, // a real GitHub link, the strongest signal
    /\b(FE|BE)\s*[-#]\s*(\d{1,6})\b/gi, // the prefix the synced data uses
    /\bPRs?\s*#?\s*(\d{1,6})\b/gi, // "PR 1234", "PRs #1234"
    /#(\d{2,6})\b/g, // a bare "#1234"
  ];

  patterns.forEach((pattern) => {
    const regex = new RegExp(pattern);
    let match = regex.exec(text);
    while (match) {
      // The FE/BE pattern captures the prefix and number separately.
      add(match[2] !== undefined ? `${match[1]}-${match[2]}` : match[1]);
      match = regex.exec(text);
    }
  });

  return found;
}

/** Whether a rating is one the spec allows. null means "not yet rated". */
function isValidRating(rating) {
  return rating === null || RATING_VALUES.includes(rating);
}

/**
 * Work out which week a manually added PR goes into, or why it cannot.
 *
 * Year and week come both or neither, so a half-supplied week cannot silently
 * land somewhere unexpected. Neither means the current week. A future week is
 * refused, since nobody can have reviewed a PR in a week that has not happened.
 *
 * @param {{year?: number, week?: number, currentWeek: {year: number, week: number}}} args
 * @returns {{target: {year: number, week: number}} | {error: string}}
 */
function resolvePrEntryWeek({ year, week, currentWeek }) {
  const hasYear = year !== undefined;
  const hasWeek = week !== undefined;

  if (hasYear !== hasWeek) {
    return { error: 'Send both year and week, or neither.' };
  }
  if (!hasYear) {
    return { target: currentWeek };
  }
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 0 || week > 53) {
    return { error: 'year must be a whole number and week must be 0 to 53.' };
  }

  const isFuture =
    year > currentWeek.year || (year === currentWeek.year && week > currentWeek.week);
  if (isFuture) {
    return { error: 'PR entries cannot be added for a future week.' };
  }

  return { target: { year, week } };
}

/**
 * Group flat entries into the per-week shape the "+ Add New" column renders.
 *
 * Newest week first, and within a week the entries stay in the order they were
 * added, so a reviewer's list reads the way they built it.
 *
 * @param {Array<object>} entries stored PR entries
 * @returns {Array<{year: number, week: number, prs: Array<object>}>}
 */
function groupEntriesByWeek(entries) {
  const byWeek = new Map();

  (entries || []).forEach((entry) => {
    const key = `${entry.year}-${entry.week}`;
    if (!byWeek.has(key)) byWeek.set(key, { year: entry.year, week: entry.week, prs: [] });
    byWeek.get(key).prs.push(entry);
  });

  return [...byWeek.values()].sort((a, b) => b.year - a.year || b.week - a.week);
}

module.exports = {
  PR_RATINGS,
  RATING_VALUES,
  PR_ENTRY_SOURCES,
  normalisePrNumber,
  extractPrNumbersFromSummary,
  isValidRating,
  groupEntriesByWeek,
  resolvePrEntryWeek,
};
