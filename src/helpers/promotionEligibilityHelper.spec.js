const {
  getPrsNeeded,
  resolvePrsNeeded,
  mongoWeekOf,
  weekMeetsRequirement,
  summariseWeeks,
  SUCCESSFUL_WEEKS_REQUIRED,
} = require('./promotionEligibilityHelper');

describe('getPrsNeeded', () => {
  test('returns 7 across the 10 to 14.99 band', () => {
    expect(getPrsNeeded(10)).toBe(7);
    expect(getPrsNeeded(12.5)).toBe(7);
    expect(getPrsNeeded(14.99)).toBe(7);
  });

  test('returns 10 across the 15 to 25.99 band', () => {
    expect(getPrsNeeded(15)).toBe(10);
    expect(getPrsNeeded(25.99)).toBe(10);
  });

  test('returns 20 across the 26 to 35.99 band', () => {
    expect(getPrsNeeded(26)).toBe(20);
    expect(getPrsNeeded(35.99)).toBe(20);
  });

  test('returns 30 across the 36 to 40 band', () => {
    expect(getPrsNeeded(36)).toBe(30);
    expect(getPrsNeeded(40)).toBe(30);
  });

  test('band boundaries do not overlap or leave gaps at the integer edges', () => {
    expect(getPrsNeeded(14.99)).toBe(7);
    expect(getPrsNeeded(15)).toBe(10);
    expect(getPrsNeeded(25.99)).toBe(10);
    expect(getPrsNeeded(26)).toBe(20);
    expect(getPrsNeeded(35.99)).toBe(20);
    expect(getPrsNeeded(36)).toBe(30);
  });

  test('clamps below the lowest band to 7 and above the highest to 30', () => {
    expect(getPrsNeeded(9.99)).toBe(7);
    expect(getPrsNeeded(0.5)).toBe(7);
    expect(getPrsNeeded(60)).toBe(30);
  });

  test('requires nothing of a reviewer committed to no hours', () => {
    expect(getPrsNeeded(0)).toBe(0);
    expect(getPrsNeeded(-5)).toBe(0);
  });

  test('treats missing or non-numeric committed hours as no requirement', () => {
    expect(getPrsNeeded(undefined)).toBe(0);
    expect(getPrsNeeded(null)).toBe(0);
    expect(getPrsNeeded('not a number')).toBe(0);
    expect(getPrsNeeded(NaN)).toBe(0);
  });

  test('accepts a numeric string, since committed hours reach us from user input', () => {
    expect(getPrsNeeded('20')).toBe(10);
  });
});

describe('resolvePrsNeeded', () => {
  test('derives the figure from committed hours when no record exists yet', () => {
    expect(resolvePrsNeeded({ committedHours: 20, existingRecord: null })).toEqual({
      prsNeeded: 10,
      prsNeededSource: 'auto',
      committedHoursChanged: false,
    });
  });

  test('reports no change when committed hours match the stored value', () => {
    const result = resolvePrsNeeded({
      committedHours: 20,
      existingRecord: { pledgedHours: 20, prsNeededOverride: null },
    });
    expect(result.committedHoursChanged).toBe(false);
    expect(result.prsNeeded).toBe(10);
  });

  test('flags a change and recalculates when committed hours have moved', () => {
    const result = resolvePrsNeeded({
      committedHours: 30,
      existingRecord: { pledgedHours: 20, prsNeededOverride: null },
    });
    expect(result).toEqual({
      prsNeeded: 20,
      prsNeededSource: 'auto',
      committedHoursChanged: true,
    });
  });

  test('an Owner override wins and stops the committed hours check', () => {
    const result = resolvePrsNeeded({
      committedHours: 40,
      existingRecord: { pledgedHours: 10, prsNeededOverride: 5 },
    });
    expect(result).toEqual({
      prsNeeded: 5,
      prsNeededSource: 'ownerOverride',
      committedHoursChanged: false,
    });
  });

  test('an override of 0 is honoured rather than treated as absent', () => {
    const result = resolvePrsNeeded({
      committedHours: 20,
      existingRecord: { pledgedHours: 20, prsNeededOverride: 0 },
    });
    expect(result.prsNeeded).toBe(0);
    expect(result.prsNeededSource).toBe('ownerOverride');
  });

  test('clearing an override returns the reviewer to the committed hours bands', () => {
    const result = resolvePrsNeeded({
      committedHours: 20,
      existingRecord: { pledgedHours: 20, prsNeededOverride: null },
    });
    expect(result.prsNeededSource).toBe('auto');
    expect(result.prsNeeded).toBe(10);
  });
});

describe('mongoWeekOf', () => {
  const weekOf = (iso) => mongoWeekOf(new Date(`${iso}T00:00:00Z`));

  // Every expectation below was taken from MongoDB itself, by running
  // { $year: ... } and { $week: ... } over the same dates. The aggregation
  // groups per week and this function decides which of those groups is "now",
  // so the two have to agree exactly or the current week never matches.
  test('weeks begin on Sunday', () => {
    // 2026-08-16 is a Sunday, 2026-08-22 the Saturday that closes the week.
    expect(weekOf('2026-08-16')).toEqual({ year: 2026, week: 33 });
    expect(weekOf('2026-08-21')).toEqual({ year: 2026, week: 33 });
    expect(weekOf('2026-08-22')).toEqual({ year: 2026, week: 33 });
    expect(weekOf('2026-08-23')).toEqual({ year: 2026, week: 34 });
  });

  test('days before the first Sunday of the year are week 0', () => {
    // 2026-01-01 is a Thursday, so the first Sunday is 2026-01-04.
    expect(weekOf('2026-01-01')).toEqual({ year: 2026, week: 0 });
    expect(weekOf('2026-01-03')).toEqual({ year: 2026, week: 0 });
    expect(weekOf('2026-01-04')).toEqual({ year: 2026, week: 1 });
  });

  test('a year that opens on a Sunday has no week 0', () => {
    // 2023-01-01 was a Sunday.
    expect(weekOf('2023-01-01')).toEqual({ year: 2023, week: 1 });
    expect(weekOf('2023-01-07')).toEqual({ year: 2023, week: 1 });
    expect(weekOf('2023-01-08')).toEqual({ year: 2023, week: 2 });
  });

  test('the year rolls over with the calendar, not with the week', () => {
    expect(weekOf('2025-12-31')).toEqual({ year: 2025, week: 52 });
    expect(weekOf('2026-01-01')).toEqual({ year: 2026, week: 0 });
  });
});

describe('weekMeetsRequirement', () => {
  test('meeting the requirement exactly counts', () => {
    expect(weekMeetsRequirement(7, 7)).toBe(true);
  });

  test('exceeding it counts and falling short does not', () => {
    expect(weekMeetsRequirement(8, 7)).toBe(true);
    expect(weekMeetsRequirement(6, 7)).toBe(false);
  });

  test('a requirement of zero is never met, so nobody is promoted on no reviews', () => {
    expect(weekMeetsRequirement(0, 0)).toBe(false);
    expect(weekMeetsRequirement(50, 0)).toBe(false);
  });

  test('a negative requirement is treated the same as zero', () => {
    expect(weekMeetsRequirement(5, -3)).toBe(false);
  });

  test('non-numeric input on either side is not a pass', () => {
    expect(weekMeetsRequirement(undefined, 7)).toBe(false);
    expect(weekMeetsRequirement(7, undefined)).toBe(false);
    expect(weekMeetsRequirement(NaN, 7)).toBe(false);
  });
});

describe('summariseWeeks', () => {
  const CURRENT = { year: 2026, week: 33 };

  const week = (weekNumber, reviewCount, year = 2026) => ({ year, week: weekNumber, reviewCount });

  test('counts only prior weeks that cleared the requirement', () => {
    const result = summariseWeeks({
      weeklyCounts: [week(33, 0), week(32, 10), week(31, 3), week(30, 7)],
      prsNeeded: 7,
      currentWeek: CURRENT,
    });

    expect(result.successfulWeeks).toBe(2);
    expect(result.remainingWeeks).toBe(0);
  });

  test('remaining weeks is what is left of the two required', () => {
    expect(
      summariseWeeks({ weeklyCounts: [], prsNeeded: 7, currentWeek: CURRENT }).remainingWeeks,
    ).toBe(SUCCESSFUL_WEEKS_REQUIRED);

    expect(
      summariseWeeks({ weeklyCounts: [week(32, 7)], prsNeeded: 7, currentWeek: CURRENT })
        .remainingWeeks,
    ).toBe(1);
  });

  test('remaining weeks floors at zero rather than going negative', () => {
    const result = summariseWeeks({
      weeklyCounts: [week(32, 9), week(31, 9), week(30, 9), week(29, 9)],
      prsNeeded: 7,
      currentWeek: CURRENT,
    });

    expect(result.successfulWeeks).toBe(4);
    expect(result.remainingWeeks).toBe(0);
  });

  test('the current week drives weeklyRequirementsMet and nothing else', () => {
    const met = summariseWeeks({
      weeklyCounts: [week(33, 7)],
      prsNeeded: 7,
      currentWeek: CURRENT,
    });
    expect(met.weeklyRequirementsMet).toBe(true);
    // Still in progress, so it does not count towards promotion yet.
    expect(met.successfulWeeks).toBe(0);
    expect(met.remainingWeeks).toBe(2);
  });

  test('a current week short of the requirement is not met', () => {
    const result = summariseWeeks({
      weeklyCounts: [week(33, 6), week(32, 10)],
      prsNeeded: 7,
      currentWeek: CURRENT,
    });
    expect(result.weeklyRequirementsMet).toBe(false);
    expect(result.successfulWeeks).toBe(1);
  });

  test('no entry for the current week means the requirement is not met', () => {
    const result = summariseWeeks({
      weeklyCounts: [week(32, 10)],
      prsNeeded: 7,
      currentWeek: CURRENT,
    });
    expect(result.weeklyRequirementsMet).toBe(false);
  });

  test('the same week number in a different year is a different week', () => {
    const result = summariseWeeks({
      weeklyCounts: [week(33, 10, 2025)],
      prsNeeded: 7,
      currentWeek: CURRENT,
    });

    // 2025 week 33 is a prior week, not the current one.
    expect(result.weeklyRequirementsMet).toBe(false);
    expect(result.successfulWeeks).toBe(1);
  });

  test('a reviewer who needs nothing accumulates no successful weeks', () => {
    const result = summariseWeeks({
      weeklyCounts: [week(33, 0), week(32, 0), week(31, 0)],
      prsNeeded: 0,
      currentWeek: CURRENT,
    });

    expect(result.successfulWeeks).toBe(0);
    expect(result.remainingWeeks).toBe(2);
    expect(result.weeklyRequirementsMet).toBe(false);
  });

  test('missing or malformed input is treated as no weeks worked', () => {
    expect(summariseWeeks({ weeklyCounts: undefined, prsNeeded: 7, currentWeek: CURRENT })).toEqual(
      { successfulWeeks: 0, remainingWeeks: 2, weeklyRequirementsMet: false },
    );
  });
});
