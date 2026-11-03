const { formatWeeklyPRs, resolveTeamLeaderNames } = require('../promotionPendingHelper');

describe('formatWeeklyPRs', () => {
  it('maps counts to week/count and sorts oldest first', () => {
    expect(
      formatWeeklyPRs([
        { year: 2026, week: 12, reviewCount: 11 },
        { year: 2026, week: 10, reviewCount: 2 },
        { year: 2025, week: 52, reviewCount: 4 },
      ]),
    ).toEqual([
      { week: '2025-W52', count: 4 },
      { week: '2026-W10', count: 2 },
      { week: '2026-W12', count: 11 },
    ]);
  });

  it('returns an empty array for missing input', () => {
    expect(formatWeeklyPRs(undefined)).toEqual([]);
    expect(formatWeeklyPRs(null)).toEqual([]);
  });
});

describe('resolveTeamLeaderNames', () => {
  it('prefers a Manager over a Mentor for the same teamCode', () => {
    const map = resolveTeamLeaderNames([
      { teamCode: 'ABC12', firstName: 'Sam', lastName: 'Mentor', role: 'Mentor' },
      { teamCode: 'ABC12', firstName: 'Chris', lastName: 'Martinez', role: 'Manager' },
    ]);

    expect(map.get('ABC12')).toBe('Chris Martinez');
  });

  it('skips blank codes and blank names', () => {
    const map = resolveTeamLeaderNames([
      { teamCode: '', firstName: 'No', lastName: 'Code', role: 'Manager' },
      { teamCode: 'XYZ99', firstName: '', lastName: '', role: 'Manager' },
      { teamCode: 'XYZ99', firstName: 'Pat', lastName: 'Lee', role: 'Mentor' },
    ]);

    expect(map.has('')).toBe(false);
    expect(map.get('XYZ99')).toBe('Pat Lee');
  });
});
