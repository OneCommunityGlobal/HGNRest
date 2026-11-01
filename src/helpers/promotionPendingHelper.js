/**
 * Helpers for the promotion confirmation modal pending list
 * (`POST /api/promotion-pending`).
 */

const TEAM_LEADER_ROLES = ['Manager', 'Mentor'];

/**
 * Map weekly review aggregates into the modal's `weeklyPRs` column shape.
 * Oldest week first so VIBGYOR badges read left to right chronologically.
 *
 * @param {Array<{year: number, week: number, reviewCount: number}>} weeklyCounts
 * @returns {Array<{week: string, count: number}>}
 */
function formatWeeklyPRs(weeklyCounts) {
  const counts = Array.isArray(weeklyCounts) ? weeklyCounts.slice() : [];

  counts.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.week - b.week;
  });

  return counts.map((entry) => ({
    week: `${entry.year}-W${entry.week}`,
    count: entry.reviewCount,
  }));
}

/**
 * Build a map of teamCode → display name for the first active Manager, else Mentor.
 *
 * @param {Array<{teamCode?: string, firstName?: string, lastName?: string, role?: string}>} leaders
 * @returns {Map<string, string>}
 */
function buildTeamLeaderNameByCode(leaders) {
  const byCode = new Map();

  (Array.isArray(leaders) ? leaders : []).forEach((leader) => {
    const code = leader.teamCode;
    if (!code || byCode.has(code)) return;

    const name = `${leader.firstName || ''} ${leader.lastName || ''}`.trim();
    if (name) byCode.set(code, name);
  });

  return byCode;
}

/**
 * Prefer Managers over Mentors when several leaders share a teamCode.
 * Callers should query with `role: { $in: TEAM_LEADER_ROLES }` and sort Managers first.
 *
 * @param {Array} leaders
 * @returns {Map<string, string>}
 */
function resolveTeamLeaderNames(leaders) {
  const managersFirst = (Array.isArray(leaders) ? leaders : []).slice().sort((a, b) => {
    if (a.role === b.role) return 0;
    if (a.role === 'Manager') return -1;
    if (b.role === 'Manager') return 1;
    return 0;
  });

  return buildTeamLeaderNameByCode(managersFirst);
}

module.exports = {
  TEAM_LEADER_ROLES,
  formatWeeklyPRs,
  buildTeamLeaderNameByCode,
  resolveTeamLeaderNames,
};
