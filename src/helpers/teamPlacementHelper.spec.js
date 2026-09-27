const {
  bandForCommittedHours,
  toMinutes,
  parseAvailabilityWindow,
  availabilityByDay,
  isPlaceableTeam,
  smallestTeam,
  standupGapMinutes,
  placeReviewer,
} = require('./teamPlacementHelper');

/** A fully configured, placeable team. */
const team = (overrides = {}) => ({
  teamName: 'Team A',
  hoursBand: '10-19.99',
  standupDay: 'Tuesday',
  standupTime: '11AM',
  members: [],
  ...overrides,
});

/** A questionnaire response in the shape the real data uses. */
const form = (availability) => ({ general: { availability } });

const withMembers = (n) => Array.from({ length: n }, (unused, i) => ({ userId: `u${i}` }));

describe('bandForCommittedHours', () => {
  test('20 and above is the 20+ band', () => {
    expect(bandForCommittedHours(20)).toBe('20+');
    expect(bandForCommittedHours(40)).toBe('20+');
    expect(bandForCommittedHours(200)).toBe('20+');
  });

  test('10 up to just under 20 is the 10-19.99 band', () => {
    expect(bandForCommittedHours(10)).toBe('10-19.99');
    expect(bandForCommittedHours(19.99)).toBe('10-19.99');
  });

  test('under 10 is unplaceable rather than dropped into the low band', () => {
    expect(bandForCommittedHours(9.99)).toBeNull();
    expect(bandForCommittedHours(0)).toBeNull();
    expect(bandForCommittedHours(-3)).toBeNull();
  });

  test('non-numeric input is unplaceable', () => {
    expect(bandForCommittedHours(undefined)).toBeNull();
    expect(bandForCommittedHours('twenty')).toBeNull();
    expect(bandForCommittedHours(NaN)).toBeNull();
  });
});

describe('toMinutes', () => {
  test('reads 12 hour times with a meridiem', () => {
    expect(toMinutes('9AM')).toBe(9 * 60);
    expect(toMinutes('11AM')).toBe(11 * 60);
    expect(toMinutes('1PM')).toBe(13 * 60);
    expect(toMinutes('10:30 PM')).toBe(22 * 60 + 30);
  });

  test('handles the two midnight and noon edge cases', () => {
    expect(toMinutes('12AM')).toBe(0);
    expect(toMinutes('12PM')).toBe(12 * 60);
  });

  test('reads 24 hour times without a meridiem', () => {
    expect(toMinutes('14:00')).toBe(14 * 60);
    expect(toMinutes('0:15')).toBe(15);
  });

  test('is case and whitespace insensitive', () => {
    expect(toMinutes('  11am ')).toBe(11 * 60);
    expect(toMinutes('11 Am')).toBe(11 * 60);
  });

  test('rejects anything it cannot read rather than guessing', () => {
    ['', 'lunchtime', '25:00', '13PM', '0AM', '9:99', null, undefined, 11].forEach((value) => {
      expect(toMinutes(value)).toBeNull();
    });
  });
});

describe('parseAvailabilityWindow', () => {
  test('reads the questionnaire range format', () => {
    expect(parseAvailabilityWindow('10AM-11AM')).toEqual({ start: 600, end: 660 });
  });

  test('treats a bare time as a one hour window', () => {
    expect(parseAvailabilityWindow('10AM')).toEqual({ start: 600, end: 660 });
  });

  test('rejects a backwards or unreadable range', () => {
    expect(parseAvailabilityWindow('11AM-10AM')).toBeNull();
    expect(parseAvailabilityWindow('whenever')).toBeNull();
    expect(parseAvailabilityWindow('')).toBeNull();
    expect(parseAvailabilityWindow(null)).toBeNull();
  });
});

describe('availabilityByDay', () => {
  test('reads the real nested shape', () => {
    const windows = availabilityByDay(form({ Monday: '10AM-11AM', Thursday: '9AM-10AM' }));
    expect([...windows.keys()].sort()).toEqual(['Monday', 'Thursday']);
    expect(windows.get('Monday')).toEqual({ start: 600, end: 660 });
  });

  test('also reads the older root level shape', () => {
    const windows = availabilityByDay({ availability: { Friday: '2PM-3PM' } });
    expect(windows.get('Friday')).toEqual({ start: 840, end: 900 });
  });

  test('skips days that are blank or unreadable instead of failing', () => {
    const windows = availabilityByDay(
      form({ Monday: '', Tuesday: 'sometime', Friday: '9AM-10AM' }),
    );
    expect([...windows.keys()]).toEqual(['Friday']);
  });

  test('missing or malformed input gives an empty map', () => {
    expect(availabilityByDay(null).size).toBe(0);
    expect(availabilityByDay({}).size).toBe(0);
    expect(availabilityByDay(form(null)).size).toBe(0);
  });
});

describe('isPlaceableTeam', () => {
  test('a fully configured team is placeable', () => {
    expect(isPlaceableTeam(team())).toBe(true);
  });

  test('a team missing any one field is not a candidate', () => {
    expect(isPlaceableTeam(team({ hoursBand: null }))).toBe(false);
    expect(isPlaceableTeam(team({ standupDay: null }))).toBe(false);
    expect(isPlaceableTeam(team({ standupTime: null }))).toBe(false);
  });

  test('an unconfigured team, which is every team today, is not a candidate', () => {
    expect(isPlaceableTeam({ teamName: 'Legacy', members: [] })).toBe(false);
    expect(isPlaceableTeam(null)).toBe(false);
  });

  test('junk in a field does not make a team placeable', () => {
    expect(isPlaceableTeam(team({ hoursBand: '30+' }))).toBe(false);
    expect(isPlaceableTeam(team({ standupDay: 'Tues' }))).toBe(false);
    expect(isPlaceableTeam(team({ standupTime: 'lunchtime' }))).toBe(false);
  });
});

describe('smallestTeam', () => {
  test('picks the fewest members', () => {
    const small = team({ teamName: 'Small', members: withMembers(2) });
    const big = team({ teamName: 'Big', members: withMembers(9) });
    expect(smallestTeam([big, small]).teamName).toBe('Small');
  });

  test('breaks ties on name so the choice is stable', () => {
    const a = team({ teamName: 'Alpha', members: withMembers(3) });
    const b = team({ teamName: 'Beta', members: withMembers(3) });
    expect(smallestTeam([b, a]).teamName).toBe('Alpha');
    expect(smallestTeam([a, b]).teamName).toBe('Alpha');
  });

  test('treats a missing members array as empty', () => {
    const none = team({ teamName: 'NoArray', members: undefined });
    const one = team({ teamName: 'AOne', members: withMembers(1) });
    expect(smallestTeam([one, none]).teamName).toBe('NoArray');
  });

  test('returns null for an empty list', () => {
    expect(smallestTeam([])).toBeNull();
  });
});

describe('standupGapMinutes', () => {
  const windows = availabilityByDay(form({ Tuesday: '10AM-11AM' }));

  test('is zero when the standup starts inside the window', () => {
    expect(standupGapMinutes(team({ standupTime: '10:30 AM' }), windows)).toBe(0);
  });

  test('is zero on both edges of the window', () => {
    expect(standupGapMinutes(team({ standupTime: '10AM' }), windows)).toBe(0);
    expect(standupGapMinutes(team({ standupTime: '11AM' }), windows)).toBe(0);
  });

  test('measures to the nearer edge when outside', () => {
    expect(standupGapMinutes(team({ standupTime: '9AM' }), windows)).toBe(60);
    expect(standupGapMinutes(team({ standupTime: '1PM' }), windows)).toBe(120);
  });

  test('is null when they gave no availability that day, which is not the same as far away', () => {
    expect(standupGapMinutes(team({ standupDay: 'Friday' }), windows)).toBeNull();
  });
});

describe('placeReviewer', () => {
  test('never places somebody into the wrong hours band', () => {
    const twentyPlus = team({ teamName: 'Twenty', hoursBand: '20+' });

    const result = placeReviewer({
      committedHours: 12,
      formResponse: form({ Tuesday: '10AM-11AM' }),
      teams: [twentyPlus],
    });

    expect(result.team).toBeNull();
    expect(result.band).toBe('10-19.99');
    expect(result.reason).toBe('noTeamConfiguredForBand');
    expect(result.needsReview).toBe(true);
  });

  test('places into the single team whose standup they are available for', () => {
    const match = team({ teamName: 'Match', standupDay: 'Tuesday', standupTime: '10:30 AM' });
    const miss = team({ teamName: 'Miss', standupDay: 'Friday', standupTime: '3PM' });

    const result = placeReviewer({
      committedHours: 12,
      formResponse: form({ Tuesday: '10AM-11AM' }),
      teams: [match, miss],
    });

    expect(result.team.teamName).toBe('Match');
    expect(result.reason).toBe('availabilityMatch');
    expect(result.needsReview).toBe(false);
  });

  test('when several teams match, takes the one with the fewest people', () => {
    const big = team({ teamName: 'Big', standupTime: '10:15 AM', members: withMembers(8) });
    const small = team({ teamName: 'Small', standupTime: '10:45 AM', members: withMembers(2) });

    const result = placeReviewer({
      committedHours: 25,
      formResponse: form({ Tuesday: '10AM-11AM' }),
      teams: [
        { ...big, hoursBand: '20+' },
        { ...small, hoursBand: '20+' },
      ],
    });

    expect(result.team.teamName).toBe('Small');
    expect(result.reason).toBe('availabilityMatchSmallest');
    expect(result.needsReview).toBe(false);
  });

  test('falls back to a standup within two hours when nothing matches exactly', () => {
    const near = team({ teamName: 'Near', standupTime: '12PM' }); // 1 hour after
    const far = team({ teamName: 'Far', standupTime: '5PM' });

    const result = placeReviewer({
      committedHours: 12,
      formResponse: form({ Tuesday: '10AM-11AM' }),
      teams: [near, far],
    });

    expect(result.team.teamName).toBe('Near');
    expect(result.reason).toBe('withinTwoHours');
    expect(result.needsReview).toBe(false);
  });

  test('two hours is inclusive, and beyond it drops to the smallest team', () => {
    const justInside = team({ teamName: 'Inside', standupTime: '1PM' }); // exactly 2h after 11AM
    let result = placeReviewer({
      committedHours: 12,
      formResponse: form({ Tuesday: '10AM-11AM' }),
      teams: [justInside],
    });
    expect(result.reason).toBe('withinTwoHours');

    const justOutside = team({ teamName: 'Outside', standupTime: '1:01 PM' });
    result = placeReviewer({
      committedHours: 12,
      formResponse: form({ Tuesday: '10AM-11AM' }),
      teams: [justOutside],
    });
    expect(result.team.teamName).toBe('Outside');
    expect(result.reason).toBe('smallestInBand');
    expect(result.needsReview).toBe(true);
  });

  test('somebody with no availability on file is placed but flagged for review', () => {
    const small = team({ teamName: 'Small', members: withMembers(1) });
    const big = team({ teamName: 'Big', members: withMembers(7) });

    const result = placeReviewer({ committedHours: 12, formResponse: null, teams: [big, small] });

    expect(result.team.teamName).toBe('Small');
    expect(result.reason).toBe('noAvailabilityOnFile');
    expect(result.needsReview).toBe(true);
  });

  test('somebody under 10 hours is not placed at all', () => {
    const result = placeReviewer({
      committedHours: 5,
      formResponse: form({ Tuesday: '10AM-11AM' }),
      teams: [team()],
    });

    expect(result.team).toBeNull();
    expect(result.band).toBeNull();
    expect(result.reason).toBe('committedHoursOutOfBands');
    expect(result.needsReview).toBe(true);
  });

  test('unconfigured teams are ignored entirely, so today nobody is placed', () => {
    const legacy = [
      { teamName: 'Legacy A', members: [] },
      { teamName: 'Legacy B', members: [] },
    ];

    const result = placeReviewer({
      committedHours: 12,
      formResponse: form({ Tuesday: '10AM-11AM' }),
      teams: legacy,
    });

    expect(result.team).toBeNull();
    expect(result.reason).toBe('noTeamConfiguredForBand');
  });

  test('an empty or missing team list does not throw', () => {
    expect(placeReviewer({ committedHours: 12, formResponse: null, teams: [] }).team).toBeNull();
    expect(placeReviewer({ committedHours: 12, formResponse: null }).team).toBeNull();
  });

  test('availability on a different day than the standup does not count as a match', () => {
    const tuesday = team({ teamName: 'Tuesday', standupDay: 'Tuesday', standupTime: '10:30 AM' });

    const result = placeReviewer({
      committedHours: 12,
      formResponse: form({ Wednesday: '10AM-11AM' }),
      teams: [tuesday],
    });

    // They have availability, just not on the standup day, so this is the
    // smallest-in-band fallback rather than the no-data one.
    expect(result.reason).toBe('smallestInBand');
    expect(result.needsReview).toBe(true);
  });
});
