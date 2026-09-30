const mongoose = require('mongoose');
const moment = require('moment-timezone');

/* =======================
   MOCKS (MUST COME FIRST)
   ======================= */

jest.mock('../../models/userProfile', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  aggregate: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({}),
  findByIdAndUpdate: jest.fn((id, update, cb) => {
    if (typeof cb === 'function') cb(null);
    return Promise.resolve({});
  }),
}));

jest.mock('../../models/badge', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../models/team', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../dashboardhelper', () =>
  jest.fn(() => ({
    laborthisweek: jest.fn().mockResolvedValue([{ timeSpent_hrs: 5 }]),
  })),
);

/* =======================
   IMPORTS AFTER MOCKS
   ======================= */

const userProfile = require('../../models/userProfile');
const badge = require('../../models/badge');
const Team = require('../../models/team');
const userHelperFactory = require('../userHelper');

const {
  getUserName,
  validateProfilePic,
  checkTeamCodeMismatch,
  getTeamManagementEmail,
  mergeHours,
  checkMinHoursMultiple,
  checkTotalHrsInCat,
  checkNoInfringementStreak,
  checkLeadTeamOfXplus,
  checkMostHrsWeek,
  checkXHrsInOneWeek,
  checkPersonalMax,
  checkXHrsForXWeeks,
  getAllTeamMembers,
  getAllWeeksData,
  updatePersonalMax,
} = userHelperFactory();

/* =======================
   TEST HELPERS
   ======================= */

// Builds a mock mongoose query chain: resolves like a promise, and also
// supports chained .sort()/.limit() calls that return the same chain.
const makeQuery = (result) => {
  const promise = Promise.resolve(result);
  promise.sort = jest.fn(() => makeQuery(result));
  promise.limit = jest.fn(() => makeQuery(result));
  return promise;
};

/* =======================
   TESTS
   ======================= */

describe('getUserName', () => {
  test('calls findById with ObjectId and projection', async () => {
    const id = new mongoose.Types.ObjectId().toString();

    userProfile.findById.mockResolvedValue({
      firstName: 'John',
      lastName: 'Doe',
    });

    const result = await getUserName(id);

    expect(userProfile.findById).toHaveBeenCalledWith(
      expect.any(mongoose.Types.ObjectId),
      'firstName lastName',
    );
    expect(result).toEqual({ firstName: 'John', lastName: 'Doe' });
  });
});

describe('validateProfilePic', () => {
  test('returns invalid for non-string', () => {
    const res = validateProfilePic(null);
    expect(res.result).toBe(false);
  });

  test('accepts http/https url', () => {
    const res = validateProfilePic('https://example.com/image.png');
    expect(res.result).toBe(true);
  });

  test('rejects invalid base64 format', () => {
    const res = validateProfilePic('invalidbase64');
    expect(res.result).toBe(false);
  });

  test('rejects oversized image', () => {
    const largeBase64 = `data:image/png;base64,${'a'.repeat(300000)}`;
    const res = validateProfilePic(largeBase64);

    expect(res.result).toBe(false);
    expect(res.errors).toContain('Image size should not exceed 50KB');
  });

  test('rejects invalid image type', () => {
    const base64 = `data:image/gif;base64,${'a'.repeat(100)}`;
    const res = validateProfilePic(base64);

    expect(res.result).toBe(false);
  });

  test('accepts valid png image', () => {
    const base64 = `data:image/png;base64,${'a'.repeat(100)}`;
    const res = validateProfilePic(base64);

    expect(res.result).toBe(true);
  });
});

describe('checkTeamCodeMismatch', () => {
  const validTeamId = new mongoose.Types.ObjectId().toString();
  const validUserId = new mongoose.Types.ObjectId().toString();

  test('returns false if user missing', async () => {
    expect(await checkTeamCodeMismatch(null)).toBe(false);
  });

  test('returns false if no teams', async () => {
    expect(await checkTeamCodeMismatch({ teams: [] })).toBe(false);
  });

  test('returns false if no other active teammates exist to compare against', async () => {
    userProfile.aggregate.mockResolvedValue([]);

    const user = {
      _id: validUserId,
      teams: [validTeamId],
      teamCode: 'ABC123',
    };

    expect(await checkTeamCodeMismatch(user)).toBe(false);
  });

  test('returns false if the user has no team code', async () => {
    userProfile.aggregate.mockResolvedValue([{ teamCode: 'ABC123' }]);

    const user = {
      _id: validUserId,
      teams: [validTeamId],
      teamCode: '',
    };

    expect(await checkTeamCodeMismatch(user)).toBe(false);
  });

  test('returns true on mismatch when suffix matches but full code differs', async () => {
    userProfile.aggregate.mockResolvedValue([{ teamCode: 'XYZ123' }]);

    const user = {
      _id: validUserId,
      teams: [validTeamId],
      teamCode: 'ABC123',
    };

    expect(await checkTeamCodeMismatch(user)).toBe(true);
  });

  test('returns false when full team code matches', async () => {
    userProfile.aggregate.mockResolvedValue([{ teamCode: 'ABC123' }]);

    const user = {
      _id: validUserId,
      teams: [validTeamId],
      teamCode: 'ABC123',
    };

    expect(await checkTeamCodeMismatch(user)).toBe(false);
  });

  test('returns false when suffix differs', async () => {
    userProfile.aggregate.mockResolvedValue([{ teamCode: 'XYZ456' }]);

    const user = {
      _id: validUserId,
      teams: [validTeamId],
      teamCode: 'ABC123',
    };

    expect(await checkTeamCodeMismatch(user)).toBe(false);
  });

  test('returns true if any teammate (out of several) shares the suffix with a different prefix', async () => {
    userProfile.aggregate.mockResolvedValue([{ teamCode: 'XYZ456' }, { teamCode: 'DEF123' }]);

    const user = {
      _id: validUserId,
      teams: [validTeamId],
      teamCode: 'ABC123',
    };

    expect(await checkTeamCodeMismatch(user)).toBe(true);
  });

  test('excludes the user themselves from the comparison query', async () => {
    userProfile.aggregate.mockResolvedValue([]);

    const user = {
      _id: validUserId,
      teams: [validTeamId],
      teamCode: 'ABC123',
    };

    await checkTeamCodeMismatch(user);

    const aggregateArgs = userProfile.aggregate.mock.calls[0][0];
    const matchStage = aggregateArgs.find((stage) => stage.$match);
    expect(matchStage.$match._id).toEqual({ $ne: expect.anything() });
  });

  test('returns false on exception', async () => {
    userProfile.aggregate.mockRejectedValue(new Error('fail'));

    const user = {
      _id: validUserId,
      teams: [validTeamId],
      teamCode: 'ABC123',
    };

    expect(await checkTeamCodeMismatch(user)).toBe(false);
  });
});

describe('getTeamManagementEmail', () => {
  test('queries active managers/admins by team', () => {
    userProfile.find.mockReturnValue({ exec: jest.fn() });

    const teamId = new mongoose.Types.ObjectId().toString();
    getTeamManagementEmail(teamId);

    expect(userProfile.find).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: true,
        role: { $in: ['Manager', 'Administrator'] },
      }),
      'email role',
    );
  });
});

describe('mergeHours', () => {
  test('concatenates two arrays', () => {
    expect(mergeHours([1, 2], [3, 4])).toEqual([1, 2, 3, 4]);
  });

  test('handles empty arrays', () => {
    expect(mergeHours([], [])).toEqual([]);
  });
});

describe('checkMinHoursMultiple', () => {
  const personId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    userProfile.updateOne.mockClear();
    userProfile.findByIdAndUpdate.mockClear();
    badge.find.mockReset();
  });

  test('returns early when no badges of that type exist', async () => {
    badge.find.mockReturnValue(makeQuery([]));

    const user = { lastWeekTangibleHrs: 20, weeklycommittedHours: 10 };
    await checkMinHoursMultiple(personId, user, []);

    expect(badge.find).toHaveBeenCalledWith({ type: 'Minimum Hours Multiple' });
  });

  test('increases count when user already has the qualifying badge', async () => {
    const candidateId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: candidateId, multiple: 2 }]));

    const user = { lastWeekTangibleHrs: 20, weeklycommittedHours: 10 };
    const badgeCollection = [{ badge: { _id: candidateId, type: 'Minimum Hours Multiple' } }];

    await checkMinHoursMultiple(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
  });

  test('adds a new badge when ratio qualifies and none is owned yet', async () => {
    const candidateId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: candidateId, multiple: 2 }]));

    const user = { lastWeekTangibleHrs: 20, weeklycommittedHours: 10 };

    await checkMinHoursMultiple(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('skips candidates the ratio does not meet', async () => {
    const candidateId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: candidateId, multiple: 5 }]));

    const user = { lastWeekTangibleHrs: 5, weeklycommittedHours: 10 };

    await checkMinHoursMultiple(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('downgrades a lower badge before adding the qualifying one', async () => {
    const candidateId = new mongoose.Types.ObjectId();
    const lowerId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: candidateId, multiple: 2 }]));

    const user = { lastWeekTangibleHrs: 20, weeklycommittedHours: 10 };
    const badgeCollection = [
      { count: 2, badge: { _id: lowerId, multiple: 1, type: 'Minimum Hours Multiple' } },
    ];

    await checkMinHoursMultiple(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('removes a lower badge in place (count 1) before adding the qualifying one', async () => {
    const candidateId = new mongoose.Types.ObjectId();
    const lowerId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: candidateId, multiple: 2 }]));

    const user = { lastWeekTangibleHrs: 20, weeklycommittedHours: 10 };
    const badgeCollection = [
      { count: 1, badge: { _id: lowerId, multiple: 1, type: 'Minimum Hours Multiple' } },
    ];

    await checkMinHoursMultiple(personId, user, badgeCollection);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });
});

describe('checkTotalHrsInCat', () => {
  const personId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    userProfile.updateOne.mockClear();
    userProfile.findByIdAndUpdate.mockClear();
    badge.find.mockReset();
  });

  test('skips categories with no logged hours', async () => {
    badge.find.mockReturnValue(makeQuery([]));

    const user = { hoursByCategory: {} };
    await checkTotalHrsInCat(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('adds a badge when category hours qualify and none is owned', async () => {
    const badgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: badgeId, totalHrs: 100, category: 'Food' }]));

    const user = { hoursByCategory: { food: 150 } };
    await checkTotalHrsInCat(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('increases count when badge already owned for that category', async () => {
    const badgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: badgeId, totalHrs: 100, category: 'Food' }]));

    const user = { hoursByCategory: { food: 150 } };
    const badgeCollection = [
      {
        count: 1,
        badge: {
          _id: badgeId,
          type: 'Total Hrs in Category',
          category: 'Food',
          totalHrs: 100,
        },
      },
    ];

    await checkTotalHrsInCat(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
  });

  test('deduplicates a repeated badge and replaces it with a higher qualifying one', async () => {
    const lowerBadgeId = new mongoose.Types.ObjectId();
    const higherBadgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(
      makeQuery([{ _id: higherBadgeId, totalHrs: 100, category: 'Food' }]),
    );

    const user = { hoursByCategory: { food: 150 } };
    const badgeCollection = [
      {
        count: 2,
        badge: {
          _id: lowerBadgeId,
          type: 'Total Hrs in Category',
          category: 'Food',
          totalHrs: 50,
        },
      },
    ];

    await checkTotalHrsInCat(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('defaults hoursByCategory to empty when missing on the user', async () => {
    badge.find.mockReturnValue(makeQuery([]));

    await checkTotalHrsInCat(personId, {}, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('does nothing when category hours are below the qualifying threshold', async () => {
    badge.find.mockReturnValue(
      makeQuery([{ _id: new mongoose.Types.ObjectId(), totalHrs: 100, category: 'Food' }]),
    );

    const user = { hoursByCategory: { food: 50 } };
    await checkTotalHrsInCat(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(userProfile.updateOne).not.toHaveBeenCalled();
  });

  test('removes a lower-ranked owned badge for the same category', async () => {
    badge.find.mockReturnValue(makeQuery([]));

    const user = { hoursByCategory: { food: 0 } };
    const higherId = new mongoose.Types.ObjectId();
    const lowerId = new mongoose.Types.ObjectId();
    const badgeCollection = [
      {
        count: 1,
        badge: { _id: higherId, type: 'Total Hrs in Category', category: 'Food', totalHrs: 100 },
      },
      {
        count: 1,
        badge: { _id: lowerId, type: 'Total Hrs in Category', category: 'Food', totalHrs: 50 },
      },
    ];

    await checkTotalHrsInCat(personId, user, badgeCollection);

    expect(badge.find).toHaveBeenCalled();
  });

  test('takes no action when the owned badge already outranks the qualifying one', async () => {
    const ownedId = new mongoose.Types.ObjectId();
    const lowerBadgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: lowerBadgeId, totalHrs: 100, category: 'Food' }]));

    const user = { hoursByCategory: { food: 150 } };
    const badgeCollection = [
      {
        count: 1,
        badge: { _id: ownedId, type: 'Total Hrs in Category', category: 'Food', totalHrs: 200 },
      },
    ];

    await checkTotalHrsInCat(personId, user, badgeCollection);

    expect(userProfile.updateOne).not.toHaveBeenCalled();
    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('checkNoInfringementStreak', () => {
  const personId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    userProfile.findByIdAndUpdate.mockClear();
    userProfile.updateOne.mockClear();
    badge.find.mockReset();
  });

  test('does nothing when there are no streak badges configured', async () => {
    badge.find.mockReturnValue(makeQuery([]));

    const user = { createdDate: new Date(), infringements: [] };
    await checkNoInfringementStreak(personId, user, []);

    expect(badge.find).toHaveBeenCalledWith({ type: 'No Infringement Streak' });
  });

  test('awards badge when user has been infringement-free long enough', async () => {
    const badgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: badgeId, months: 1 }]));

    const user = {
      createdDate: moment().subtract(2, 'months').toDate(),
      infringements: [],
      oldInfringements: [],
    };

    await checkNoInfringementStreak(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('awards a longer streak badge when there have been no old infringements either', async () => {
    const badgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: badgeId, months: 13 }]));

    const user = {
      createdDate: moment().subtract(14, 'months').toDate(),
      infringements: [],
      oldInfringements: [],
    };

    await checkNoInfringementStreak(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('deduplicates multiple owned streak badges down to the best one', async () => {
    badge.find.mockReturnValue(makeQuery([]));

    const user = { createdDate: new Date(), infringements: [] };
    const badgeCollection = [
      { badge: { _id: new mongoose.Types.ObjectId(), type: 'No Infringement Streak', months: 6 } },
      { badge: { _id: new mongoose.Types.ObjectId(), type: 'No Infringement Streak', months: 12 } },
      { badge: { _id: new mongoose.Types.ObjectId(), type: 'No Infringement Streak', months: 3 } },
    ];

    await checkNoInfringementStreak(personId, user, badgeCollection);

    expect(badge.find).toHaveBeenCalledWith({ type: 'No Infringement Streak' });
  });

  test('replaces the owned badge with a different qualifying streak badge', async () => {
    const ownedId = new mongoose.Types.ObjectId();
    const newBadgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: newBadgeId, months: 1 }]));

    const user = {
      createdDate: moment().subtract(2, 'months').toDate(),
      infringements: [],
      oldInfringements: [],
    };
    const badgeCollection = [
      { badge: { _id: ownedId, type: 'No Infringement Streak', months: 1 } },
    ];

    await checkNoInfringementStreak(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
  });

  test('does not award a badge when not enough time has elapsed yet', async () => {
    badge.find.mockReturnValue(makeQuery([{ _id: new mongoose.Types.ObjectId(), months: 6 }]));

    const user = {
      createdDate: moment().subtract(1, 'months').toDate(),
      infringements: [],
    };

    await checkNoInfringementStreak(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('does not award a badge after a recent infringement', async () => {
    badge.find.mockReturnValue(makeQuery([{ _id: new mongoose.Types.ObjectId(), months: 6 }]));

    const user = {
      createdDate: moment().subtract(8, 'months').toDate(),
      infringements: [{ date: moment().subtract(1, 'months').toDate() }],
    };

    await checkNoInfringementStreak(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('ends the streak check without replacing when the badge already matches', async () => {
    const badgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: badgeId, months: 1 }]));

    const user = {
      createdDate: moment().subtract(2, 'months').toDate(),
      infringements: [],
      oldInfringements: [],
    };
    const badgeCollection = [
      { badge: { _id: badgeId, type: 'No Infringement Streak', months: 1 } },
    ];

    await checkNoInfringementStreak(personId, user, badgeCollection);

    expect(userProfile.updateOne).not.toHaveBeenCalled();
  });

  test('does not award a longer streak badge when the user was recently created', async () => {
    badge.find.mockReturnValue(makeQuery([{ _id: new mongoose.Types.ObjectId(), months: 13 }]));

    const user = {
      createdDate: moment().subtract(1, 'months').toDate(),
      infringements: [],
      oldInfringements: [],
    };

    await checkNoInfringementStreak(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('does not award a longer streak badge after a recent old infringement', async () => {
    badge.find.mockReturnValue(makeQuery([{ _id: new mongoose.Types.ObjectId(), months: 13 }]));

    const user = {
      createdDate: moment().subtract(14, 'months').toDate(),
      infringements: [],
      oldInfringements: [{ date: moment().subtract(1, 'days').toDate() }],
    };

    await checkNoInfringementStreak(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('getAllTeamMembers', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    Team.aggregate.mockReset();
  });

  test('returns aggregated team results', async () => {
    const teams = [{ _id: new mongoose.Types.ObjectId(), teamName: 'Team A', members: [] }];
    Team.aggregate.mockResolvedValue(teams);

    const result = await getAllTeamMembers(userId);

    expect(result).toEqual(teams);
    expect(Team.aggregate).toHaveBeenCalled();
  });

  test('throws when aggregation fails', async () => {
    Team.aggregate.mockRejectedValue(new Error('db down'));

    await expect(getAllTeamMembers(userId)).rejects.toThrow('db down');
  });
});

describe('checkLeadTeamOfXplus', () => {
  const personId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    userProfile.findByIdAndUpdate.mockClear();
    userProfile.updateOne.mockClear();
    Team.aggregate.mockReset();
    badge.find.mockReset();
  });

  test('returns early for roles that cannot lead teams', async () => {
    const user = { role: 'Volunteer' };
    await checkLeadTeamOfXplus(personId, user, []);

    expect(Team.aggregate).not.toHaveBeenCalled();
  });

  test('adds a qualifying team-size badge for an eligible leader', async () => {
    const memberId = new mongoose.Types.ObjectId();
    const qualifyingBadgeId = new mongoose.Types.ObjectId();

    Team.aggregate.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(),
        teamName: 'Team A',
        members: [{ userId: memberId, role: 'Volunteer' }],
      },
    ]);
    badge.find.mockReturnValue(makeQuery([{ _id: qualifyingBadgeId, people: 1 }]));

    const user = { role: 'Manager' };
    await checkLeadTeamOfXplus(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('replaces an existing team-size badge with a higher qualifying one', async () => {
    const memberOne = new mongoose.Types.ObjectId();
    const memberTwo = new mongoose.Types.ObjectId();
    const oldBadgeId = new mongoose.Types.ObjectId();
    const qualifyingBadgeId = new mongoose.Types.ObjectId();

    Team.aggregate.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(),
        teamName: 'Team A',
        members: [
          { userId: memberOne, role: 'Volunteer' },
          { userId: memberTwo, role: 'Volunteer' },
        ],
      },
    ]);
    badge.find.mockReturnValue(makeQuery([{ _id: qualifyingBadgeId, people: 2 }]));

    const user = { role: 'Manager' };
    const badgeCollection = [{ badge: { _id: oldBadgeId, type: 'Lead a team of X+', people: 1 } }];

    await checkLeadTeamOfXplus(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
  });

  test('filters out leader-role and duplicate members when sizing the team', async () => {
    const leaderId = new mongoose.Types.ObjectId();
    const memberId = new mongoose.Types.ObjectId();
    const qualifyingBadgeId = new mongoose.Types.ObjectId();

    Team.aggregate.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(),
        teamName: 'Team A',
        members: [
          { userId: leaderId, role: 'Manager' },
          { userId: memberId, role: 'Volunteer' },
          { userId: memberId, role: 'Volunteer' },
        ],
      },
    ]);
    badge.find.mockReturnValue(makeQuery([{ _id: qualifyingBadgeId, people: 1 }]));

    const user = { role: 'Manager' };
    await checkLeadTeamOfXplus(personId, user, []);

    expect(badge.find).toHaveBeenCalledWith(expect.objectContaining({ people: { $lte: 1 } }));
  });

  test('skips badgeCollection entries that are not team-size badges', async () => {
    const memberId = new mongoose.Types.ObjectId();
    const qualifyingBadgeId = new mongoose.Types.ObjectId();

    Team.aggregate.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(),
        teamName: 'Team A',
        members: [{ userId: memberId, role: 'Volunteer' }],
      },
    ]);
    badge.find.mockReturnValue(makeQuery([{ _id: qualifyingBadgeId, people: 1 }]));

    const user = { role: 'Manager' };
    const badgeCollection = [{ badge: { type: 'Personal Max' } }];

    await checkLeadTeamOfXplus(personId, user, badgeCollection);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('deduplicates multiple owned team-size badges', async () => {
    const memberId = new mongoose.Types.ObjectId();
    const qualifyingBadgeId = new mongoose.Types.ObjectId();

    Team.aggregate.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(),
        teamName: 'Team A',
        members: [{ userId: memberId, role: 'Volunteer' }],
      },
    ]);
    badge.find.mockReturnValue(makeQuery([{ _id: qualifyingBadgeId, people: 1 }]));

    const user = { role: 'Manager' };
    const badgeCollection = [
      { badge: { _id: new mongoose.Types.ObjectId(), type: 'Lead a team of X+', people: 1 } },
      { badge: { _id: new mongoose.Types.ObjectId(), type: 'Lead a team of X+', people: 5 } },
      { badge: { _id: new mongoose.Types.ObjectId(), type: 'Lead a team of X+', people: 2 } },
    ];

    await checkLeadTeamOfXplus(personId, user, badgeCollection);

    expect(badge.find).toHaveBeenCalled();
  });

  test('does nothing when no team-size badge qualifies', async () => {
    const memberId = new mongoose.Types.ObjectId();

    Team.aggregate.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(),
        teamName: 'Team A',
        members: [{ userId: memberId, role: 'Volunteer' }],
      },
    ]);
    badge.find.mockReturnValue(makeQuery([]));

    const user = { role: 'Manager' };
    await checkLeadTeamOfXplus(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(userProfile.updateOne).not.toHaveBeenCalled();
  });

  test('leaves the badge alone when the owned one already qualifies', async () => {
    const memberId = new mongoose.Types.ObjectId();
    const ownedBadgeId = new mongoose.Types.ObjectId();

    Team.aggregate.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(),
        teamName: 'Team A',
        members: [{ userId: memberId, role: 'Volunteer' }],
      },
    ]);
    badge.find.mockReturnValue(makeQuery([{ _id: ownedBadgeId, people: 1 }]));

    const user = { role: 'Manager' };
    const badgeCollection = [
      { badge: { _id: ownedBadgeId, type: 'Lead a team of X+', people: 1 } },
    ];

    await checkLeadTeamOfXplus(personId, user, badgeCollection);

    expect(userProfile.updateOne).not.toHaveBeenCalled();
    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('getAllWeeksData', () => {
  test('returns hours for each elapsed week', async () => {
    const personId = new mongoose.Types.ObjectId().toString();
    const user = { createdDate: moment().subtract(3, 'days').toDate() };

    const result = await getAllWeeksData(personId, user);

    expect(Array.isArray(result)).toBe(true);
  });
});

describe('updatePersonalMax', () => {
  test('updates personalBestMaxHrs from merged hours history', async () => {
    const personId = new mongoose.Types.ObjectId().toString();
    const user = {
      createdDate: moment().subtract(3, 'days').toDate(),
      savedTangibleHrs: [10, 20],
      save: jest.fn().mockResolvedValue({}),
    };

    await updatePersonalMax(personId, user);

    expect(user.save).toHaveBeenCalled();
    expect(user.personalBestMaxHrs).toBeGreaterThanOrEqual(20);
  });
});

describe('checkPersonalMax', () => {
  const personId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    userProfile.updateOne.mockClear();
    userProfile.findByIdAndUpdate.mockClear();
    badge.find.mockReset();
  });

  test('returns early when no Personal Max badge type exists', async () => {
    badge.find.mockResolvedValue([]);

    const user = { lastWeekTangibleHrs: 10, savedTangibleHrs: [10] };
    await checkPersonalMax(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('adds badge when user has none yet', async () => {
    const masterId = new mongoose.Types.ObjectId();
    badge.find.mockResolvedValue([{ _id: masterId }]);

    const user = { lastWeekTangibleHrs: 5, savedTangibleHrs: [5] };
    await checkPersonalMax(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('updates earnedDate when last week breaks the personal record', async () => {
    const masterId = new mongoose.Types.ObjectId();
    badge.find.mockResolvedValue([{ _id: masterId }]);

    const user = { lastWeekTangibleHrs: 30, savedTangibleHrs: [10, 20, 30] };
    const badgeCollection = [{ _id: masterId, badge: { _id: masterId, type: 'Personal Max' } }];

    await checkPersonalMax(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
  });

  test('does not update when last week did not break the record', async () => {
    const masterId = new mongoose.Types.ObjectId();
    badge.find.mockResolvedValue([{ _id: masterId }]);

    const user = { lastWeekTangibleHrs: 10, savedTangibleHrs: [30, 20, 10] };
    const badgeCollection = [{ _id: masterId, badge: { _id: masterId, type: 'Personal Max' } }];

    await checkPersonalMax(personId, user, badgeCollection);

    expect(userProfile.updateOne).not.toHaveBeenCalled();
  });

  test('defaults savedTangibleHrs to empty when missing on the user', async () => {
    const masterId = new mongoose.Types.ObjectId();
    badge.find.mockResolvedValue([{ _id: masterId }]);

    const user = { lastWeekTangibleHrs: 0 };
    await checkPersonalMax(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });
});

describe('checkMostHrsWeek', () => {
  const personId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    userProfile.findByIdAndUpdate.mockClear();
    userProfile.updateOne.mockClear();
    badge.findOne.mockReset();
    userProfile.aggregate.mockReset();
  });

  test('does nothing when user is under their committed hours', async () => {
    const user = { weeklycommittedHours: 10, lastWeekTangibleHrs: 5 };
    await checkMostHrsWeek(personId, user, []);

    expect(badge.findOne).not.toHaveBeenCalled();
  });

  test('adds badge when user has the most hours of the week', async () => {
    const badgeId = new mongoose.Types.ObjectId();
    badge.findOne.mockResolvedValue({ _id: badgeId });
    userProfile.aggregate.mockResolvedValue([{ maxHours: 15 }]);

    const user = { weeklycommittedHours: 10, lastWeekTangibleHrs: 15 };
    await checkMostHrsWeek(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('returns early when no badge type is configured', async () => {
    badge.findOne.mockResolvedValue(null);

    const user = { weeklycommittedHours: 10, lastWeekTangibleHrs: 15 };
    await checkMostHrsWeek(personId, user, []);

    expect(userProfile.aggregate).not.toHaveBeenCalled();
  });

  test('returns early when no active-user results are found', async () => {
    badge.findOne.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    userProfile.aggregate.mockResolvedValue([]);

    const user = { weeklycommittedHours: 10, lastWeekTangibleHrs: 15 };
    await checkMostHrsWeek(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('does nothing when the user is not the top performer', async () => {
    badge.findOne.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    userProfile.aggregate.mockResolvedValue([{ maxHours: 40 }]);

    const user = { weeklycommittedHours: 10, lastWeekTangibleHrs: 15 };
    await checkMostHrsWeek(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('increases count when the badge is already owned', async () => {
    const badgeId = new mongoose.Types.ObjectId();
    badge.findOne.mockResolvedValue({ _id: badgeId });
    userProfile.aggregate.mockResolvedValue([{ maxHours: 15 }]);

    const user = { weeklycommittedHours: 10, lastWeekTangibleHrs: 15 };
    const badgeCollection = [{ badge: { _id: badgeId, type: 'Most Hrs in Week' } }];

    await checkMostHrsWeek(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
  });
});

describe('checkXHrsInOneWeek', () => {
  const personId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    userProfile.findByIdAndUpdate.mockClear();
    userProfile.updateOne.mockClear();
    badge.find.mockReset();
  });

  test('adds badge matching the exact hours logged last week', async () => {
    const badgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: badgeId, totalHrs: 10 }]));

    const user = { savedTangibleHrs: [5, 10] };
    await checkXHrsInOneWeek(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('skips non-matching candidates before finding the right one', async () => {
    const badgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(
      makeQuery([
        { _id: new mongoose.Types.ObjectId(), totalHrs: 20 },
        { _id: badgeId, totalHrs: 10 },
      ]),
    );

    const user = { savedTangibleHrs: [5, 10] };
    await checkXHrsInOneWeek(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('increases count when the matching badge is already owned', async () => {
    const badgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: badgeId, totalHrs: 10 }]));

    const user = { savedTangibleHrs: [5, 10] };
    const badgeCollection = [{ badge: { _id: badgeId, type: 'X Hours for X Week Streak' } }];

    await checkXHrsInOneWeek(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
  });
});

describe('checkXHrsForXWeeks', () => {
  const personId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    userProfile.updateOne.mockClear();
    userProfile.findByIdAndUpdate.mockClear();
    badge.find.mockReset();
  });

  test('returns early with no saved hours', async () => {
    const user = { savedTangibleHrs: [] };
    await checkXHrsForXWeeks(personId, user, []);

    expect(badge.find).not.toHaveBeenCalled();
  });

  test('awards a streak badge for a multi-week streak', async () => {
    const newBadgeId = new mongoose.Types.ObjectId();
    badge.find.mockResolvedValue([{ _id: newBadgeId, badgeName: '5 HOURS 2-WEEK STREAK' }]);

    const user = { savedTangibleHrs: [5, 5] };
    await checkXHrsForXWeeks(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('increases count when the streak badge is already owned', async () => {
    const newBadgeId = new mongoose.Types.ObjectId();
    badge.find.mockResolvedValue([{ _id: newBadgeId, badgeName: '5 HOURS 2-WEEK STREAK' }]);

    const user = { savedTangibleHrs: [5, 5] };
    const badgeCollection = [{ badge: { badgeName: '5 HOURS 2-WEEK STREAK' } }];

    await checkXHrsForXWeeks(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
  });

  test('downgrades and replaces a lower streak badge with count > 1', async () => {
    const newBadgeId = new mongoose.Types.ObjectId();
    const oldBadgeId = new mongoose.Types.ObjectId();
    badge.find.mockResolvedValue([{ _id: newBadgeId, badgeName: '5 HOURS 2-WEEK STREAK' }]);

    const user = { savedTangibleHrs: [5, 5] };
    const badgeCollection = [
      {
        count: 2,
        badge: { _id: oldBadgeId, badgeName: 'Other Badge', totalHrs: 5, weeks: 1 },
      },
    ];

    await checkXHrsForXWeeks(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('replaces a lower streak badge in place when count is 1', async () => {
    const newBadgeId = new mongoose.Types.ObjectId();
    const oldBadgeId = new mongoose.Types.ObjectId();
    badge.find.mockResolvedValue([{ _id: newBadgeId, badgeName: '5 HOURS 2-WEEK STREAK' }]);

    const user = { savedTangibleHrs: [5, 5] };
    const badgeCollection = [
      {
        count: 1,
        badge: { _id: oldBadgeId, badgeName: 'Other Badge', totalHrs: 5, weeks: 1 },
      },
    ];

    await checkXHrsForXWeeks(personId, user, badgeCollection);

    expect(userProfile.updateOne).toHaveBeenCalled();
  });

  test('delegates to checkXHrsInOneWeek for a single-week streak', async () => {
    const oneWeekBadgeId = new mongoose.Types.ObjectId();
    badge.find.mockReturnValue(makeQuery([{ _id: oneWeekBadgeId, totalHrs: 5 }]));

    const user = { savedTangibleHrs: [3, 5] };
    await checkXHrsForXWeeks(personId, user, []);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('stops counting the streak once hours differ', async () => {
    badge.find.mockResolvedValue([]);

    const user = { savedTangibleHrs: [3, 5, 5] };
    await checkXHrsForXWeeks(personId, user, []);

    expect(badge.find).toHaveBeenCalled();
  });

  test('returns when no matching streak badges exist', async () => {
    badge.find.mockResolvedValue([]);

    const user = { savedTangibleHrs: [5, 5] };
    await checkXHrsForXWeeks(personId, user, []);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(userProfile.updateOne).not.toHaveBeenCalled();
  });

  test('returns early when badgeCollection is not an array', async () => {
    const newBadgeId = new mongoose.Types.ObjectId();
    badge.find.mockResolvedValue([{ _id: newBadgeId, badgeName: '5 HOURS 2-WEEK STREAK' }]);

    const user = { savedTangibleHrs: [5, 5] };
    await checkXHrsForXWeeks(personId, user, null);

    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('skips malformed entries and falls through when totalHrs does not match', async () => {
    const newBadgeId = new mongoose.Types.ObjectId();
    badge.find.mockResolvedValue([{ _id: newBadgeId, badgeName: '5 HOURS 2-WEEK STREAK' }]);

    const user = { savedTangibleHrs: [5, 5] };
    const badgeCollection = [
      null,
      { badge: null },
      {
        count: 1,
        badge: { _id: new mongoose.Types.ObjectId(), badgeName: 'Other', totalHrs: 99, weeks: 1 },
      },
    ];

    await checkXHrsForXWeeks(personId, user, badgeCollection);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('leaves a badge alone when its week requirement already meets the streak', async () => {
    const newBadgeId = new mongoose.Types.ObjectId();
    const ownedBadgeId = new mongoose.Types.ObjectId();
    badge.find.mockResolvedValue([{ _id: newBadgeId, badgeName: '5 HOURS 2-WEEK STREAK' }]);

    const user = { savedTangibleHrs: [5, 5] };
    const badgeCollection = [
      {
        count: 1,
        badge: { _id: ownedBadgeId, badgeName: 'Other Badge', totalHrs: 5, weeks: 5 },
      },
    ];

    await checkXHrsForXWeeks(personId, user, badgeCollection);

    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
  });
});
