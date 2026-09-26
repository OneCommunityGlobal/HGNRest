/**
 * Helpers for the Promotion Eligibility dashboard (doc item #23).
 *
 * The "PRs Needed" figure is driven by the reviewer's weekly committed hours.
 * Bands come straight from the spec:
 *
 *    7 PRs for 10 - 14.99 hr/wk
 *   10 PRs for 15 - 25.99 hr/wk
 *   20 PRs for 26 - 35.99 hr/wk
 *   30 PRs for 36 - 40    hr/wk
 *
 * The "Weekly Requirements" and "Remaining Weeks" columns hang off the same
 * figure: a week counts as successful when the reviewer reviewed at least
 * `prsNeeded` PRs in it, and promotion needs two such weeks.
 */

const PRS_NEEDED_BANDS = [
  { minHours: 10, maxHours: 14.99, prsNeeded: 7 },
  { minHours: 15, maxHours: 25.99, prsNeeded: 10 },
  { minHours: 26, maxHours: 35.99, prsNeeded: 20 },
  { minHours: 36, maxHours: 40, prsNeeded: 30 },
];

/**
 * Map weekly committed hours onto the number of PR reviews required that week.
 *
 * The spec only defines bands from 10 to 40 hours, but `weeklycommittedHours`
 * allows values outside that range, so the edges are handled here:
 *
 *   - 0 or less, or a non-numeric value: 0 PRs required. Somebody committed to
 *     no hours cannot be held to a review quota.
 *   - above 0 but below 10: the lowest band (7). Requiring nothing at all would
 *     let a 9 hr/wk reviewer sit on the table indefinitely with no requirement.
 *   - above 40: the highest band (30).
 *
 * The two clamped cases are open question 3 to Jae. They are deliberately kept
 * in one place so a single edit changes the behaviour once he answers.
 *
 * @param {number} committedHours value of userProfile.weeklycommittedHours
 * @returns {number} PRs the reviewer must review that week
 */
function getPrsNeeded(committedHours) {
  const hours = Number(committedHours);

  if (!Number.isFinite(hours) || hours <= 0) return 0;

  const band = PRS_NEEDED_BANDS.find((b) => hours >= b.minHours && hours <= b.maxHours);
  if (band) return band.prsNeeded;

  // Outside the specified range, clamp to the nearest defined band.
  const lowest = PRS_NEEDED_BANDS[0];
  const highest = PRS_NEEDED_BANDS[PRS_NEEDED_BANDS.length - 1];
  return hours < lowest.minHours ? lowest.prsNeeded : highest.prsNeeded;
}

/**
 * Work out the PRs Needed figure for one reviewer, honouring an Owner override.
 *
 * Per the spec, once an Owner edits PRs Needed by hand the value stops tracking
 * committed hours, so the change check is skipped entirely for that reviewer.
 *
 * @param {object} params
 * @param {number} params.committedHours current userProfile.weeklycommittedHours
 * @param {object|null} params.existingRecord the stored PromotionEligibility doc, if any
 * @returns {{prsNeeded: number, prsNeededSource: string, committedHoursChanged: boolean}}
 */
function resolvePrsNeeded({ committedHours, existingRecord }) {
  const override = existingRecord ? existingRecord.prsNeededOverride : null;

  if (override !== null && override !== undefined) {
    return {
      prsNeeded: override,
      prsNeededSource: 'ownerOverride',
      committedHoursChanged: false,
    };
  }

  // No override, so the figure tracks committed hours and we report whether
  // those hours moved since the last time this reviewer was calculated.
  const previousHours = existingRecord ? existingRecord.pledgedHours : undefined;
  const committedHoursChanged =
    previousHours !== undefined &&
    previousHours !== null &&
    Number(previousHours) !== Number(committedHours);

  return {
    prsNeeded: getPrsNeeded(committedHours),
    prsNeededSource: 'auto',
    committedHoursChanged,
  };
}

/**
 * The year and week number a date falls in, matching MongoDB's `$year` and
 * `$week` exactly.
 *
 * `$week` counts weeks that begin on Sunday, which is also how HGN weeks run,
 * and puts the days before the year's first Sunday in week 0. Both sides of the
 * comparison have to agree on that, because the per-week counts are grouped in
 * an aggregation and "which week is now" is worked out here in JavaScript.
 *
 * UTC throughout, since `dateOfWork` is a plain "YYYY-MM-DD" string that
 * `$toDate` reads as UTC midnight.
 *
 * @param {Date} date
 * @returns {{year: number, week: number}}
 */
function mongoWeekOf(date) {
  const year = date.getUTCFullYear();

  const startOfYear = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor(
    (Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - startOfYear) / 86400000,
  );

  // Day index of the year's first Sunday. Jan 1 on a Sunday makes this 0.
  const firstSunday = (7 - new Date(startOfYear).getUTCDay()) % 7;

  return { year, week: Math.floor((dayOfYear - firstSunday + 7) / 7) };
}

/**
 * Successful weeks a reviewer must accumulate before they can be promoted.
 * The spec: "They need 2 weeks of successful weeks to get promoted. So
 * 'Remaining weeks' should be 2 - (number of previous weeks where they have
 * satisfied the minimum requirement)".
 */
const SUCCESSFUL_WEEKS_REQUIRED = 2;

/**
 * Whether one week's review count clears that week's requirement.
 *
 * A requirement of zero is treated as "not assessable" rather than as trivially
 * met. Committed hours of zero or less produce `prsNeeded === 0`, and dev alone
 * has 46 accounts in that state plus one at -3 hours. Counting their weeks as
 * successful would walk them to zero remaining weeks and offer them up for
 * promotion without a single review. This is the same edge as open question 3
 * to Jae and moves with it.
 *
 * @param {number} reviewsThatWeek PRs the reviewer reviewed in the week
 * @param {number} prsNeeded PRs required that week, from the committed hours bands
 * @returns {boolean}
 */
function weekMeetsRequirement(reviewsThatWeek, prsNeeded) {
  const required = Number(prsNeeded);
  if (!Number.isFinite(required) || required <= 0) return false;

  const reviewed = Number(reviewsThatWeek);
  if (!Number.isFinite(reviewed)) return false;

  return reviewed >= required;
}

/**
 * Turn a reviewer's per-week review counts into the three figures the table's
 * "Weekly Requirements" and "Remaining Weeks" columns need.
 *
 * `weeklyCounts` is expected newest first and to include the current, still
 * running week when there is one. The current week is deliberately excluded
 * from `successfulWeeks`: the spec counts "previous weeks where they have
 * satisfied the minimum requirement", and a week still in progress has not
 * finished failing yet. It drives `weeklyRequirementsMet` instead, which the
 * spec describes as satisfaction "for the current period".
 *
 * @param {object} params
 * @param {Array<{year: number, week: number, reviewCount: number}>} params.weeklyCounts newest first
 * @param {number} params.prsNeeded PRs required per week
 * @param {{year: number, week: number}} params.currentWeek the week "now" falls in
 * @returns {{successfulWeeks: number, remainingWeeks: number, weeklyRequirementsMet: boolean}}
 */
function summariseWeeks({ weeklyCounts, prsNeeded, currentWeek }) {
  const counts = Array.isArray(weeklyCounts) ? weeklyCounts : [];

  const isCurrentWeek = (entry) =>
    Boolean(currentWeek) && entry.year === currentWeek.year && entry.week === currentWeek.week;

  const currentEntry = counts.find(isCurrentWeek);
  const weeklyRequirementsMet = weekMeetsRequirement(
    currentEntry ? currentEntry.reviewCount : 0,
    prsNeeded,
  );

  const successfulWeeks = counts.filter(
    (entry) => !isCurrentWeek(entry) && weekMeetsRequirement(entry.reviewCount, prsNeeded),
  ).length;

  return {
    successfulWeeks,
    remainingWeeks: Math.max(0, SUCCESSFUL_WEEKS_REQUIRED - successfulWeeks),
    weeklyRequirementsMet,
  };
}

module.exports = {
  PRS_NEEDED_BANDS,
  SUCCESSFUL_WEEKS_REQUIRED,
  getPrsNeeded,
  resolvePrsNeeded,
  mongoWeekOf,
  weekMeetsRequirement,
  summariseWeeks,
};
