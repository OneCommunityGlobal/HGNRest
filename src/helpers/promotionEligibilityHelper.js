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

module.exports = { PRS_NEEDED_BANDS, getPrsNeeded, resolvePrsNeeded };
