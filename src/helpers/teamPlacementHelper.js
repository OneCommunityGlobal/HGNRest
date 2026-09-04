/**
 * Team placement for the Promotion Eligibility dashboard (doc item #23).
 *
 * The spec places a newly promoted reviewer onto a team using, in order:
 *
 *   1. Hours band, which is REQUIRED. A 10-19.99 hr/wk person is only ever
 *      eligible for a 10-hour team, a 20+ person only for a 20+ team.
 *   2. Availability against the team's weekly standup:
 *        - more than one team matches -> the team with the fewest people
 *        - no team matches            -> a team whose standup is within 2
 *                                        hours of their availability, else the
 *                                        smallest team in the band
 *
 * None of that information existed anywhere before this change. It is not on
 * the team model, and it is not encoded in team names either: of 1046 active
 * teams on dev, one has a weekday in its name and none has a time or an hours
 * band. So teams now carry the two facts explicitly, and a team missing either
 * one is simply not a placement candidate. That is what keeps this from
 * needing a backfill across a thousand mostly-disposable teams.
 *
 * Everything here is pure, so the placement rules are testable without a
 * database.
 */

const HOURS_BANDS = ['10-19.99', '20+'];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** How far a standup may sit from someone's availability and still be offered. */
const NEARBY_HOURS = 2;

/**
 * The hours band a reviewer belongs to, from their committed hours.
 *
 * The spec's bands are "10-19.99" and "20+", which leaves people under 10
 * hr/wk unplaceable. That is not hypothetical, dev has 46 such accounts, so
 * they return null and get reported rather than being quietly dropped into the
 * low band. Same open question as the PRs Needed clamping (question 3 to Jae).
 *
 * @param {number} committedHours userProfile.weeklycommittedHours
 * @returns {string|null} a member of HOURS_BANDS, or null when unplaceable
 */
function bandForCommittedHours(committedHours) {
  const hours = Number(committedHours);
  if (!Number.isFinite(hours)) return null;
  if (hours >= 20) return '20+';
  if (hours >= 10) return '10-19.99';
  return null;
}

/**
 * Minutes past midnight for a "9AM", "10:30 PM" or "14:00" style time.
 *
 * The questionnaire stores availability as strings like "10AM-11AM", and the
 * team standup time is typed in by hand, so both sides arrive as free text.
 *
 * @returns {number|null} minutes since midnight, or null if unparseable
 */
function toMinutes(value) {
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3] ? match[3].toUpperCase() : null;

  if (minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'AM') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
  } else if (hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

/**
 * Parse one questionnaire availability entry, for example "10AM-11AM".
 *
 * A single time with no range ("10AM") is read as a one hour window, since a
 * few responses on dev are stored that way.
 *
 * @returns {{start: number, end: number}|null} minutes since midnight
 */
function parseAvailabilityWindow(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  const [rawStart, rawEnd] = value.split('-');
  const start = toMinutes(rawStart);
  if (start === null) return null;

  const end = rawEnd === undefined ? start + 60 : toMinutes(rawEnd);
  if (end === null || end < start) return null;

  return { start, end };
}

/**
 * A reviewer's availability keyed by day, from the setup questionnaire.
 *
 * The real data lives at `general.availability` with all seven days. The older
 * root level shape is read too, because one of the two competing form models
 * declares it that way and accepting both costs nothing.
 *
 * @param {object|null} formResponse an hgnformresponses document
 * @returns {Map<string, {start: number, end: number}>} day to window
 */
function availabilityByDay(formResponse) {
  const windows = new Map();
  if (!formResponse) return windows;

  const raw =
    (formResponse.general && formResponse.general.availability) || formResponse.availability;
  if (!raw || typeof raw !== 'object') return windows;

  DAYS.forEach((day) => {
    const parsed = parseAvailabilityWindow(raw[day]);
    if (parsed) windows.set(day, parsed);
  });

  return windows;
}

/** Whether a team carries enough placement data to be a candidate at all. */
function isPlaceableTeam(team) {
  return Boolean(
    team &&
      HOURS_BANDS.includes(team.hoursBand) &&
      DAYS.includes(team.standupDay) &&
      toMinutes(team.standupTime) !== null,
  );
}

const memberCount = (team) => (Array.isArray(team.members) ? team.members.length : 0);

/**
 * Pick the team with the fewest people, breaking ties on name so the same
 * inputs always give the same placement. A stable answer matters here: the
 * preview somebody confirms has to be the placement that is committed.
 */
function smallestTeam(teams) {
  if (!teams.length) return null;

  return teams.reduce((best, team) => {
    const delta = memberCount(team) - memberCount(best);
    if (delta !== 0) return delta < 0 ? team : best;
    return String(team.teamName) < String(best.teamName) ? team : best;
  });
}

/**
 * Gap in minutes between a standup and a reviewer's availability that day.
 *
 * Zero when the standup starts inside the window they gave, otherwise the
 * distance to the nearer edge. Returns null when they gave no availability for
 * that day at all, which is a different thing from being far away.
 */
function standupGapMinutes(team, windows) {
  const window = windows.get(team.standupDay);
  if (!window) return null;

  const standup = toMinutes(team.standupTime);
  if (standup === null) return null;

  if (standup >= window.start && standup <= window.end) return 0;
  return standup < window.start ? window.start - standup : standup - window.end;
}

/**
 * Work out which team a reviewer should be placed on.
 *
 * @param {object} params
 * @param {number} params.committedHours the reviewer's weeklycommittedHours
 * @param {object|null} params.formResponse their questionnaire document, if any
 * @param {Array<object>} params.teams candidate teams, each carrying hoursBand,
 *   standupDay, standupTime and members
 * @returns {{team: object|null, band: string|null, reason: string, needsReview: boolean}}
 */
function placeReviewer({ committedHours, formResponse, teams }) {
  const band = bandForCommittedHours(committedHours);
  if (!band) {
    return { team: null, band: null, reason: 'committedHoursOutOfBands', needsReview: true };
  }

  const candidates = (teams || []).filter(
    (team) => isPlaceableTeam(team) && team.hoursBand === band,
  );
  if (!candidates.length) {
    return { team: null, band, reason: 'noTeamConfiguredForBand', needsReview: true };
  }

  const windows = availabilityByDay(formResponse);

  // No availability on file at all. The spec's fallback chain does not cover
  // this, and on dev it is the common case rather than the exception: only 94
  // active profiles out of 2639 have ever answered the questionnaire. Putting
  // them on the smallest team in their band is the least surprising thing to
  // do, but it is flagged so the confirmation modal can show it as a guess.
  if (!windows.size) {
    return {
      team: smallestTeam(candidates),
      band,
      reason: 'noAvailabilityOnFile',
      needsReview: true,
    };
  }

  const exact = candidates.filter((team) => standupGapMinutes(team, windows) === 0);
  if (exact.length === 1) {
    return { team: exact[0], band, reason: 'availabilityMatch', needsReview: false };
  }
  if (exact.length > 1) {
    // Spec: "More than 1 - assign to the team with the least people".
    return {
      team: smallestTeam(exact),
      band,
      reason: 'availabilityMatchSmallest',
      needsReview: false,
    };
  }

  // Spec: "Assign to team with availability within 2 hours of their
  // availability OR smallest team if no team is within 2 hours".
  const nearby = candidates.filter((team) => {
    const gap = standupGapMinutes(team, windows);
    return gap !== null && gap <= NEARBY_HOURS * 60;
  });
  if (nearby.length) {
    return { team: smallestTeam(nearby), band, reason: 'withinTwoHours', needsReview: false };
  }

  return { team: smallestTeam(candidates), band, reason: 'smallestInBand', needsReview: true };
}

module.exports = {
  HOURS_BANDS,
  DAYS,
  NEARBY_HOURS,
  bandForCommittedHours,
  toMinutes,
  parseAvailabilityWindow,
  availabilityByDay,
  isPlaceableTeam,
  smallestTeam,
  standupGapMinutes,
  placeReviewer,
};
