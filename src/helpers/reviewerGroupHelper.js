/**
 * Helpers for the "Review for This Week" reviewer groups (doc item #23).
 *
 * A group's membership is derived from an alphabetical range rather than stored
 * as a list of people. The range is the rule, so nobody has to maintain
 * membership as volunteers join and leave, and an Owner editing a range
 * re-splits the table immediately.
 *
 * The letter comes from the reviewer's FIRST name, falling back to the last
 * name when there is no usable first name. The spec is explicit about this:
 * "95XXPRT Members (Members with first names starting with A-N)". It is kept in
 * `groupingLetter` alone so the choice stays a one-line change.
 */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * The three groups the spec names. Seeded on first read, so a fresh database
 * needs no migration step.
 */
const DEFAULT_REVIEWER_GROUPS = [
  {
    key: 'all',
    label: 'All Members',
    rangeStart: null,
    rangeEnd: null,
    editable: false,
    sortOrder: 0,
  },
  {
    key: '95xx',
    label: '95XXPRT Members',
    rangeStart: 'A',
    rangeEnd: 'N',
    editable: true,
    sortOrder: 1,
  },
  {
    key: '97xx',
    label: '97XXPRT Members',
    rangeStart: 'O',
    rangeEnd: 'Z',
    editable: true,
    sortOrder: 2,
  },
];

/** Fold accents down to plain ASCII so Álvarez and Alvarez group together. */
function stripAccents(value) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Coerce a range boundary to a single uppercase A-Z letter, or null if it is
 * not one. Boundaries reach us from a text input, so anything can arrive.
 */
function normaliseLetter(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]$/.test(trimmed) ? trimmed : null;
}

function firstLetterOf(name) {
  if (typeof name !== 'string') return null;
  return normaliseLetter(stripAccents(name).trim().charAt(0));
}

/**
 * The letter that decides which group a reviewer falls into.
 *
 * The spec names the groups by first name, so that is what is read first. The
 * last name is only a fallback for accounts with no usable first name.
 *
 * Returns null when neither name yields an A-Z letter, which happens on
 * placeholder and test accounts. Those reviewers match no lettered group, and
 * `rangeWarnings` is not the place that surfaces them, so they are only ever
 * visible under All Members.
 */
function groupingLetter(reviewer) {
  if (!reviewer) return null;
  return firstLetterOf(reviewer.firstName) || firstLetterOf(reviewer.lastName);
}

function letterInGroupRange(letter, group) {
  const start = normaliseLetter(group.rangeStart);
  const end = normaliseLetter(group.rangeEnd);
  if (!start || !end) return false;
  return letter >= start && letter <= end;
}

/**
 * Whether a reviewer belongs to a group.
 *
 * A group with no range, which is only ever All Members, takes everybody
 * including reviewers whose name yields no letter.
 */
function isReviewerInGroup(reviewer, group) {
  const start = normaliseLetter(group.rangeStart);
  const end = normaliseLetter(group.rangeEnd);
  if (!start || !end) return true;

  const letter = groupingLetter(reviewer);
  if (!letter) return false;

  return letter >= start && letter <= end;
}

/**
 * Validate an Owner-supplied range and hand back the normalised letters.
 *
 * @returns {{valid: boolean, rangeStart: string|null, rangeEnd: string|null, error: string|null}}
 */
function validateRange({ rangeStart, rangeEnd }) {
  const start = normaliseLetter(rangeStart);
  const end = normaliseLetter(rangeEnd);

  if (!start || !end) {
    return {
      valid: false,
      rangeStart: null,
      rangeEnd: null,
      error: 'rangeStart and rangeEnd must each be a single letter from A to Z.',
    };
  }

  if (start > end) {
    return {
      valid: false,
      rangeStart: start,
      rangeEnd: end,
      error: `Range ends before it starts: ${end} comes before ${start}.`,
    };
  }

  return { valid: true, rangeStart: start, rangeEnd: end, error: null };
}

function describeLetters(letters) {
  if (letters.length === 1) return letters[0];
  return `${letters[0]}-${letters[letters.length - 1]}`;
}

/** Collapse a sorted letter list into contiguous runs, so gaps read as A-C not A, B, C. */
function contiguousRuns(letters) {
  return letters.reduce((runs, letter) => {
    const current = runs[runs.length - 1];
    const isNext =
      current && LETTERS.indexOf(letter) === LETTERS.indexOf(current[current.length - 1]) + 1;

    if (isNext) current.push(letter);
    else runs.push([letter]);

    return runs;
  }, []);
}

/**
 * Describe overlaps and gaps across the lettered groups.
 *
 * These are warnings rather than validation errors on purpose. Rejecting an
 * overlap would mean an Owner could not widen A-N to A-P without shrinking O-Z
 * first, which is a trap. Since a group is a filter on the table rather than an
 * assignment, a reviewer appearing under two groups is harmless.
 *
 * @returns {string[]} empty when the lettered groups tile A-Z exactly
 */
function rangeWarnings(groups) {
  const ranged = (groups || []).filter(
    (group) => normaliseLetter(group.rangeStart) && normaliseLetter(group.rangeEnd),
  );
  const warnings = [];

  ranged.forEach((group, index) => {
    ranged.slice(index + 1).forEach((other) => {
      const shared = LETTERS.filter(
        (letter) => letterInGroupRange(letter, group) && letterInGroupRange(letter, other),
      );
      if (shared.length) {
        warnings.push(`${group.label} and ${other.label} both cover ${describeLetters(shared)}`);
      }
    });
  });

  const uncovered = LETTERS.filter(
    (letter) => !ranged.some((group) => letterInGroupRange(letter, group)),
  );
  contiguousRuns(uncovered).forEach((run) => {
    warnings.push(`No group covers ${describeLetters(run)}`);
  });

  return warnings;
}

/**
 * Derive a stable, url safe key from an Owner-supplied group label.
 *
 * The key is what the frontend sends back to filter the table, so it must not
 * collide with an existing group and must not change when the label is later
 * renamed. Returns null if the label contains nothing sluggable.
 */
function slugifyGroupKey(label, existingKeys = []) {
  if (typeof label !== 'string') return null;

  const base = stripAccents(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!base) return null;
  if (!existingKeys.includes(base)) return base;

  let suffix = 2;
  while (existingKeys.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

module.exports = {
  DEFAULT_REVIEWER_GROUPS,
  normaliseLetter,
  groupingLetter,
  isReviewerInGroup,
  validateRange,
  rangeWarnings,
  slugifyGroupKey,
};
