jest.mock('../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const mongoose = require('mongoose');
const { hasPermission } = require('../utilities/permissions');
const promotionEligibilityController = require('./promotionEligibilityController');

const OWNER_ID = '665234c757ca141fe891e1ca';
const REVIEWER_ID = '637af0c0fb9bbc1e308cff62';

describe('updatePrsNeeded', () => {
  let PromotionEligibility;
  let controller;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    PromotionEligibility = { findOneAndUpdate: jest.fn() };
    controller = promotionEligibilityController({}, {}, {}, PromotionEligibility);

    mockReq = {
      params: { reviewerId: REVIEWER_ID },
      body: {
        requestor: { requestorId: OWNER_ID, role: 'Owner' },
        prsNeeded: 12,
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe('authorisation', () => {
    it.each(['Administrator', 'Manager', 'Core Team', 'Volunteer'])(
      'refuses a %s, since the spec limits editing to the Owner class',
      async (role) => {
        mockReq.body.requestor.role = role;

        await controller.updatePrsNeeded(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(PromotionEligibility.findOneAndUpdate).not.toHaveBeenCalled();
      },
    );

    it('allows an Owner through', async () => {
      PromotionEligibility.findOneAndUpdate.mockResolvedValue({ prsNeeded: 12 });

      await controller.updatePrsNeeded(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('validation', () => {
    it('rejects a reviewer id that is not a valid ObjectId', async () => {
      mockReq.params.reviewerId = 'not-an-object-id';

      await controller.updatePrsNeeded(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(PromotionEligibility.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it.each([-1, 2.5, '10', undefined, NaN])('rejects %p as a PRs Needed value', async (value) => {
      mockReq.body.prsNeeded = value;

      await controller.updatePrsNeeded(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(PromotionEligibility.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('accepts zero, which is a meaningful requirement rather than a missing value', async () => {
      mockReq.body.prsNeeded = 0;
      PromotionEligibility.findOneAndUpdate.mockResolvedValue({ prsNeeded: 0 });

      await controller.updatePrsNeeded(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const [, update] = PromotionEligibility.findOneAndUpdate.mock.calls[0];
      expect(update.$set.prsNeededOverride).toBe(0);
    });
  });

  describe('setting an override', () => {
    beforeEach(() => {
      PromotionEligibility.findOneAndUpdate.mockResolvedValue({ prsNeeded: 12 });
    });

    it('pins the figure and records who set it', async () => {
      await controller.updatePrsNeeded(mockReq, mockRes);

      const [filter, update] = PromotionEligibility.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ reviewerId: REVIEWER_ID });
      expect(update.$set).toMatchObject({
        prsNeededOverride: 12,
        prsNeededSource: 'ownerOverride',
        prsNeededOverrideBy: OWNER_ID,
        prsNeeded: 12,
      });
      expect(update.$set.prsNeededOverrideAt).toBeInstanceOf(Date);
    });

    it('keeps requiredPRs in step so the current page shows the edited figure', async () => {
      await controller.updatePrsNeeded(mockReq, mockRes);

      const [, update] = PromotionEligibility.findOneAndUpdate.mock.calls[0];
      expect(update.$set.requiredPRs).toBe(12);
    });

    it('clears any pending committed hours change, which the override replaces', async () => {
      await controller.updatePrsNeeded(mockReq, mockRes);

      const [, update] = PromotionEligibility.findOneAndUpdate.mock.calls[0];
      expect(update.$set.committedHoursChanged).toBe(false);
    });
  });

  describe('clearing an override', () => {
    beforeEach(() => {
      mockReq.body.prsNeeded = null;
      PromotionEligibility.findOneAndUpdate.mockResolvedValue({ prsNeeded: 7 });
    });

    it('returns the reviewer to automatic tracking', async () => {
      await controller.updatePrsNeeded(mockReq, mockRes);

      const [, update] = PromotionEligibility.findOneAndUpdate.mock.calls[0];
      expect(update.$set).toMatchObject({
        prsNeededOverride: null,
        prsNeededOverrideBy: null,
        prsNeededOverrideAt: null,
        prsNeededSource: 'auto',
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('leaves prsNeeded alone so the next load recalculates it from committed hours', async () => {
      await controller.updatePrsNeeded(mockReq, mockRes);

      const [, update] = PromotionEligibility.findOneAndUpdate.mock.calls[0];
      expect(update.$set).not.toHaveProperty('prsNeeded');
      expect(update.$set).not.toHaveProperty('requiredPRs');
    });
  });

  describe('failure handling', () => {
    it('404s when the reviewer has no record yet', async () => {
      PromotionEligibility.findOneAndUpdate.mockResolvedValue(null);

      await controller.updatePrsNeeded(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('500s and logs when the write fails', async () => {
      PromotionEligibility.findOneAndUpdate.mockRejectedValue(new Error('mongo is down'));

      await controller.updatePrsNeeded(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      // eslint-disable-next-line global-require
      expect(require('../startup/logger').logException).toHaveBeenCalled();
    });
  });
});

describe('getPromotionEligibilityData, filtering by reviewer group', () => {
  const REVIEWERS = [
    {
      _id: '637af0c0fb9bbc1e308cff01',
      firstName: 'Ann',
      lastName: 'Adams',
      weeklycommittedHours: 20,
    },
    {
      _id: '637af0c0fb9bbc1e308cff02',
      firstName: 'Jane',
      lastName: 'Doe',
      weeklycommittedHours: 20,
    },
    {
      _id: '637af0c0fb9bbc1e308cff03',
      firstName: 'Ola',
      lastName: 'Olsen',
      weeklycommittedHours: 20,
    },
    {
      _id: '637af0c0fb9bbc1e308cff04',
      firstName: 'Wei',
      lastName: 'Zhang',
      weeklycommittedHours: 20,
    },
  ];

  const GROUPS = [
    { key: 'all', label: 'All Members', rangeStart: null, rangeEnd: null },
    { key: '95xx', label: '95XXPRT Members', rangeStart: 'A', rangeEnd: 'N' },
    { key: '97xx', label: '97XXPRT Members', rangeStart: 'O', rangeEnd: 'Z' },
  ];

  let UserProfile;
  let TimeEntry;
  let Task;
  let PromotionEligibility;
  let ReviewerGroup;
  let controller;
  let mockRes;

  const requestFor = (body = {}) => ({
    body: { requestor: { requestorId: OWNER_ID, role: 'Administrator' }, ...body },
  });

  const namesReturned = () =>
    mockRes.json.mock.calls[0][0].map((entry) => entry.reviewerName).sort();

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);

    UserProfile = { find: jest.fn(() => ({ lean: () => Promise.resolve(REVIEWERS) })) };
    TimeEntry = { aggregate: jest.fn().mockResolvedValue([]) };
    Task = { countDocuments: jest.fn().mockResolvedValue(0) };
    PromotionEligibility = {
      find: jest.fn(() => ({ lean: () => Promise.resolve([]) })),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    ReviewerGroup = { find: jest.fn(() => ({ lean: () => Promise.resolve(GROUPS) })) };

    controller = promotionEligibilityController(
      UserProfile,
      TimeEntry,
      Task,
      PromotionEligibility,
      ReviewerGroup,
    );

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  it('returns every reviewer when no group is requested, as it does today', async () => {
    await controller.getPromotionEligibilityData(requestFor(), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(namesReturned()).toEqual(['Ann Adams', 'Jane Doe', 'Ola Olsen', 'Wei Zhang']);
    expect(ReviewerGroup.find).not.toHaveBeenCalled();
  });

  it('returns every reviewer for the All Members group without consulting a range', async () => {
    await controller.getPromotionEligibilityData(requestFor({ groupKey: 'all' }), mockRes);

    expect(namesReturned()).toHaveLength(4);
  });

  it('returns only the A-N half for the 95XXPRT group', async () => {
    await controller.getPromotionEligibilityData(requestFor({ groupKey: '95xx' }), mockRes);

    expect(namesReturned()).toEqual(['Ann Adams', 'Jane Doe']);
  });

  it('returns only the O-Z half for the 97XXPRT group', async () => {
    await controller.getPromotionEligibilityData(requestFor({ groupKey: '97xx' }), mockRes);

    expect(namesReturned()).toEqual(['Ola Olsen', 'Wei Zhang']);
  });

  it('filters before the per-reviewer queries, so a narrow group does less work', async () => {
    await controller.getPromotionEligibilityData(requestFor({ groupKey: '95xx' }), mockRes);

    expect(Task.countDocuments).toHaveBeenCalledTimes(2);
    expect(PromotionEligibility.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('400s on a group key that does not exist rather than silently returning everyone', async () => {
    await controller.getPromotionEligibilityData(requestFor({ groupKey: 'nope' }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(UserProfile.find).not.toHaveBeenCalled();
  });

  it('falls back to the default ranges when no group has been stored yet', async () => {
    ReviewerGroup.find = jest.fn(() => ({ lean: () => Promise.resolve([]) }));

    await controller.getPromotionEligibilityData(requestFor({ groupKey: '95xx' }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(namesReturned()).toEqual(['Ann Adams', 'Jane Doe']);
  });

  it('still refuses a requestor without getReports', async () => {
    hasPermission.mockResolvedValue(false);

    await controller.getPromotionEligibilityData(requestFor({ groupKey: '95xx' }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(UserProfile.find).not.toHaveBeenCalled();
  });
});

describe('getPromotionEligibilityData, weekly requirements and remaining weeks', () => {
  const REVIEWER = {
    _id: '637af0c0fb9bbc1e308cff62',
    firstName: 'Ann',
    lastName: 'Adams',
    weeklycommittedHours: 10, // 7 PRs needed
    createdDate: '2020-01-01',
  };

  let UserProfile;
  let TimeEntry;
  let Task;
  let PromotionEligibility;
  let controller;
  let mockRes;

  // Fixed so the "current week" never drifts under the suite. 2026-08-19 is a
  // Wednesday, which MongoDB's $week puts in 2026 week 33.
  const NOW = new Date('2026-08-19T12:00:00Z');
  const CURRENT_WEEK = { year: 2026, week: 33 };

  const request = () => ({ body: { requestor: { requestorId: OWNER_ID, role: 'Administrator' } } });

  const entryReturned = () => mockRes.json.mock.calls[0][0][0];

  const givenWeeklyCounts = (counts) => {
    TimeEntry.aggregate = jest.fn().mockResolvedValue(counts);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(NOW);
    hasPermission.mockResolvedValue(true);

    UserProfile = { find: jest.fn(() => ({ lean: () => Promise.resolve([REVIEWER]) })) };
    TimeEntry = { aggregate: jest.fn().mockResolvedValue([]) };
    Task = { countDocuments: jest.fn().mockResolvedValue(0) };
    PromotionEligibility = {
      find: jest.fn(() => ({ lean: () => Promise.resolve([]) })),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };

    controller = promotionEligibilityController(
      UserProfile,
      TimeEntry,
      Task,
      PromotionEligibility,
      null,
    );

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts distinct review tasks per week, not hours, when deciding a successful week', async () => {
    await controller.getPromotionEligibilityData(request(), mockRes);

    const pipeline = TimeEntry.aggregate.mock.calls[0][0];
    const group = pipeline.find((stage) => stage.$group);
    const project = pipeline.find((stage) => stage.$project);

    // The old version summed hours and filtered on pledgedHours / 2. Nothing in
    // the pipeline should be doing arithmetic on hours any more.
    expect(JSON.stringify(pipeline)).not.toContain('totalSeconds');
    expect(group.$group.reviewedTaskIds).toEqual({ $addToSet: '$taskId' });
    expect(project.$project.reviewCount).toEqual({ $size: '$reviewedTaskIds' });
  });

  it('groups by year as well as week, so the same week number across years stays separate', async () => {
    await controller.getPromotionEligibilityData(request(), mockRes);

    const pipeline = TimeEntry.aggregate.mock.calls[0][0];
    const group = pipeline.find((stage) => stage.$group);

    expect(group.$group._id).toHaveProperty('year');
    expect(group.$group._id).toHaveProperty('week');
  });

  it('counts a prior week that met the requirement and leaves one week remaining', async () => {
    givenWeeklyCounts([{ year: 2026, week: 32, reviewCount: 7 }]);

    await controller.getPromotionEligibilityData(request(), mockRes);

    const entry = entryReturned();
    expect(entry.prsNeeded).toBe(7);
    expect(entry.successfulWeeks).toBe(1);
    expect(entry.remainingWeeks).toBe(1);
  });

  it('does not count a prior week that fell short', async () => {
    givenWeeklyCounts([
      { year: 2026, week: 32, reviewCount: 6 },
      { year: 2026, week: 31, reviewCount: 7 },
    ]);

    await controller.getPromotionEligibilityData(request(), mockRes);

    expect(entryReturned().successfulWeeks).toBe(1);
  });

  it('reports the current week through weeklyRequirementsMet without counting it', async () => {
    givenWeeklyCounts([{ ...CURRENT_WEEK, reviewCount: 8 }]);

    await controller.getPromotionEligibilityData(request(), mockRes);

    const entry = entryReturned();
    expect(entry.weeklyRequirementsMet).toBe(true);
    expect(entry.successfulWeeks).toBe(0);
    expect(entry.remainingWeeks).toBe(2);
  });

  it('holds weeklyRequirementsMet false when this week is still short', async () => {
    givenWeeklyCounts([
      { ...CURRENT_WEEK, reviewCount: 3 },
      { year: 2026, week: 32, reviewCount: 7 },
      { year: 2026, week: 31, reviewCount: 7 },
    ]);

    await controller.getPromotionEligibilityData(request(), mockRes);

    const entry = entryReturned();
    expect(entry.weeklyRequirementsMet).toBe(false);
    // Promotion eligibility is remainingWeeks, and it is separately satisfied.
    expect(entry.remainingWeeks).toBe(0);
  });

  it('never counts a week for a reviewer whose committed hours require nothing', async () => {
    UserProfile.find = jest.fn(() => ({
      lean: () => Promise.resolve([{ ...REVIEWER, weeklycommittedHours: 0 }]),
    }));
    givenWeeklyCounts([
      { ...CURRENT_WEEK, reviewCount: 0 },
      { year: 2026, week: 32, reviewCount: 0 },
      { year: 2026, week: 31, reviewCount: 0 },
    ]);

    await controller.getPromotionEligibilityData(request(), mockRes);

    const entry = entryReturned();
    expect(entry.prsNeeded).toBe(0);
    expect(entry.successfulWeeks).toBe(0);
    expect(entry.remainingWeeks).toBe(2);
    expect(entry.weeklyRequirementsMet).toBe(false);
  });

  it('uses the Owner override, not the bands, as the weekly bar', async () => {
    PromotionEligibility.find = jest.fn(() => ({
      lean: () =>
        Promise.resolve([{ reviewerId: REVIEWER._id, pledgedHours: 10, prsNeededOverride: 12 }]),
    }));
    givenWeeklyCounts([
      { year: 2026, week: 32, reviewCount: 9 }, // clears 7, short of 12
      { year: 2026, week: 31, reviewCount: 12 },
    ]);

    await controller.getPromotionEligibilityData(request(), mockRes);

    const entry = entryReturned();
    expect(entry.prsNeeded).toBe(12);
    expect(entry.successfulWeeks).toBe(1);
  });

  describe('isNewMember', () => {
    const withCreatedDate = (createdDate) => {
      UserProfile.find = jest.fn(() => ({
        lean: () => Promise.resolve([{ ...REVIEWER, createdDate }]),
      }));
    };

    it('is true for somebody who joined inside the last week', async () => {
      withCreatedDate('2026-08-17T12:00:00Z');

      await controller.getPromotionEligibilityData(request(), mockRes);

      expect(entryReturned().isNewMember).toBe(true);
    });

    it('is true exactly a week out, which the spec includes', async () => {
      withCreatedDate('2026-08-12T12:00:00Z');

      await controller.getPromotionEligibilityData(request(), mockRes);

      expect(entryReturned().isNewMember).toBe(true);
    });

    it('is false a day past the week, not months later as it used to be', async () => {
      withCreatedDate('2026-08-11T12:00:00Z');

      await controller.getPromotionEligibilityData(request(), mockRes);

      expect(entryReturned().isNewMember).toBe(false);
    });
  });
});

describe('previewPromotions', () => {
  const ID_A = '637af0c0fb9bbc1e308cff01';
  const ID_B = '637af0c0fb9bbc1e308cff02';
  const TEAM_SMALL = '637af0c0fb9bbc1e308cfa01';
  const TEAM_BIG = '637af0c0fb9bbc1e308cfa02';

  const USERS = [
    { _id: ID_A, firstName: 'Ann', lastName: 'Adams', weeklycommittedHours: 12 },
    { _id: ID_B, firstName: 'Bob', lastName: 'Brown', weeklycommittedHours: 25 },
  ];

  const TEAMS = [
    {
      _id: TEAM_SMALL,
      teamName: 'Small Ten',
      hoursBand: '10-19.99',
      standupDay: 'Tuesday',
      standupTime: '10:30 AM',
      members: [],
    },
    {
      _id: TEAM_BIG,
      teamName: 'Big Twenty',
      hoursBand: '20+',
      standupDay: 'Friday',
      standupTime: '3PM',
      members: [{ userId: 'x' }, { userId: 'y' }],
    },
  ];

  let UserProfile;
  let Team;
  let HgnFormResponses;
  let controller;
  let mockRes;

  const request = (body = {}) => ({
    body: { requestor: { requestorId: OWNER_ID, role: 'Administrator' }, ...body },
  });

  const build = () =>
    promotionEligibilityController(
      UserProfile,
      { aggregate: jest.fn().mockResolvedValue([]) },
      { countDocuments: jest.fn().mockResolvedValue(0) },
      { find: jest.fn(() => ({ lean: () => Promise.resolve([]) })), findOneAndUpdate: jest.fn() },
      null,
      Team,
      HgnFormResponses,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);

    UserProfile = { find: jest.fn(() => ({ lean: () => Promise.resolve(USERS) })) };
    Team = { find: jest.fn(() => ({ lean: () => Promise.resolve(TEAMS) })) };
    HgnFormResponses = { find: jest.fn(() => ({ lean: () => Promise.resolve([]) })) };
    controller = build();

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  const body = () => mockRes.json.mock.calls[0][0];

  it('refuses a requestor without the promote permission', async () => {
    hasPermission.mockResolvedValue(false);

    await controller.previewPromotions(request({ memberIds: [ID_A] }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(UserProfile.find).not.toHaveBeenCalled();
  });

  it('400s on an empty or missing member list', async () => {
    await controller.previewPromotions(request({ memberIds: [] }), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    await controller.previewPromotions(request({}), mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('400s on a malformed member id rather than querying', async () => {
    await controller.previewPromotions(request({ memberIds: ['not-an-id'] }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(UserProfile.find).not.toHaveBeenCalled();
  });

  it('places each reviewer into a team matching their hours band', async () => {
    await controller.previewPromotions(request({ memberIds: [ID_A, ID_B] }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    const { placements } = body();
    expect(placements).toHaveLength(2);
    expect(placements[0]).toMatchObject({
      reviewerId: ID_A,
      band: '10-19.99',
      teamName: 'Small Ten',
    });
    expect(placements[1]).toMatchObject({ reviewerId: ID_B, band: '20+', teamName: 'Big Twenty' });
  });

  it('writes nothing at all', async () => {
    await controller.previewPromotions(request({ memberIds: [ID_A] }), mockRes);

    // The only Team and UserProfile methods the mocks expose are reads, so a
    // write would have thrown rather than passed silently.
    expect(Team.find).toHaveBeenCalled();
    expect(Team.findByIdAndUpdate).toBeUndefined();
    expect(UserProfile.findByIdAndUpdate).toBeUndefined();
  });

  it('queries only configured teams, so the 1000+ legacy teams are never loaded', async () => {
    await controller.previewPromotions(request({ memberIds: [ID_A] }), mockRes);

    const query = Team.find.mock.calls[0][0];
    expect(query.isActive).toBe(true);
    expect(query.hoursBand).toEqual({ $ne: null });
    expect(query.standupDay).toEqual({ $ne: null });
    expect(query.standupTime).toEqual({ $ne: null });
  });

  it('flags a reviewer with no availability on file', async () => {
    await controller.previewPromotions(request({ memberIds: [ID_A] }), mockRes);

    const { placements, warnings } = body();
    expect(placements[0].reason).toBe('noAvailabilityOnFile');
    expect(placements[0].needsReview).toBe(true);
    expect(warnings.join(' ')).toContain('without matching availability');
  });

  it('uses availability when it is on file', async () => {
    HgnFormResponses.find = jest.fn(() => ({
      lean: () =>
        Promise.resolve([{ user_id: ID_A, general: { availability: { Tuesday: '10AM-11AM' } } }]),
    }));
    controller = build();

    await controller.previewPromotions(request({ memberIds: [ID_A] }), mockRes);

    expect(body().placements[0]).toMatchObject({
      reason: 'availabilityMatch',
      needsReview: false,
      teamName: 'Small Ten',
    });
  });

  it('reports a reviewer it cannot place instead of dropping them', async () => {
    UserProfile.find = jest.fn(() => ({
      lean: () => Promise.resolve([{ ...USERS[0], weeklycommittedHours: 4 }]),
    }));
    controller = build();

    await controller.previewPromotions(request({ memberIds: [ID_A] }), mockRes);

    const { placements, warnings } = body();
    expect(placements[0]).toMatchObject({ teamId: null, reason: 'committedHoursOutOfBands' });
    expect(warnings.join(' ')).toContain('could not be placed');
  });

  it('reports an id that matches no profile rather than throwing', async () => {
    UserProfile.find = jest.fn(() => ({ lean: () => Promise.resolve([]) }));
    controller = build();

    await controller.previewPromotions(request({ memberIds: [ID_A] }), mockRes);

    expect(body().placements[0].reason).toBe('reviewerNotFound');
  });

  it('warns when no Team model is wired in, instead of pretending it placed people', async () => {
    controller = promotionEligibilityController(
      UserProfile,
      { aggregate: jest.fn() },
      { countDocuments: jest.fn() },
      { find: jest.fn(), findOneAndUpdate: jest.fn() },
      null,
      undefined,
      undefined,
    );

    await controller.previewPromotions(request({ memberIds: [ID_A] }), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(body().warnings.join(' ')).toContain('Team placement is unavailable');
    expect(body().placements[0].teamId).toBeNull();
  });
});

describe('promoteMembers, placement is opt-in', () => {
  const ID_A = '637af0c0fb9bbc1e308cff01';
  const TEAM = '637af0c0fb9bbc1e308cfa01';

  let UserProfile;
  let Team;
  let PromotionEligibility;
  let controller;
  let mockRes;
  let savedUser;

  const request = (body = {}) => ({
    body: { requestor: { requestorId: OWNER_ID, role: 'Administrator' }, ...body },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);

    // promoteMembers wraps its writes in a transaction. There is no database
    // here, so the session is stubbed rather than the transaction skipped,
    // which keeps the code under test on its real path.
    jest.spyOn(mongoose, 'startSession').mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(true),
      abortTransaction: jest.fn().mockResolvedValue(true),
      endSession: jest.fn(),
    });

    savedUser = {
      _id: ID_A,
      firstName: 'Ann',
      lastName: 'Adams',
      role: 'Volunteer',
      teams: [],
      save: jest.fn().mockResolvedValue(true),
    };
    UserProfile = { findById: jest.fn(() => ({ session: () => Promise.resolve(savedUser) })) };
    Team = {
      exists: jest.fn().mockResolvedValue(false),
      countDocuments: jest.fn().mockResolvedValue(1),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    };
    PromotionEligibility = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    controller = promotionEligibilityController(
      UserProfile,
      {},
      {},
      PromotionEligibility,
      null,
      Team,
      null,
    );

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  it('without placements it behaves exactly as before: role change, no team touched', async () => {
    await controller.promoteMembers(request({ memberIds: [ID_A] }), mockRes);

    expect(savedUser.role).toBe('Promoted Reviewer');
    expect(savedUser.teams).toEqual([]);
    expect(Team.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('with placements it assigns the team on both sides of the relationship', async () => {
    await controller.promoteMembers(
      request({ memberIds: [ID_A], placements: [{ reviewerId: ID_A, teamId: TEAM }] }),
      mockRes,
    );

    expect(savedUser.role).toBe('Promoted Reviewer');
    expect(savedUser.teams.map(String)).toEqual([TEAM]);
    expect(Team.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(Team.findByIdAndUpdate.mock.calls[0][0]).toBe(TEAM);
  });

  it('does not double-add somebody who is already on the team', async () => {
    Team.exists = jest.fn().mockResolvedValue(true);

    await controller.promoteMembers(
      request({ memberIds: [ID_A], placements: [{ reviewerId: ID_A, teamId: TEAM }] }),
      mockRes,
    );

    expect(Team.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('a null teamId promotes without placing, which is the modal opting out', async () => {
    await controller.promoteMembers(
      request({ memberIds: [ID_A], placements: [{ reviewerId: ID_A, teamId: null }] }),
      mockRes,
    );

    expect(savedUser.role).toBe('Promoted Reviewer');
    expect(Team.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('400s on a placement for somebody not in memberIds', async () => {
    await controller.promoteMembers(
      request({
        memberIds: [ID_A],
        placements: [{ reviewerId: '637af0c0fb9bbc1e308cff99', teamId: TEAM }],
      }),
      mockRes,
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(savedUser.save).not.toHaveBeenCalled();
  });

  it('400s on a malformed placement', async () => {
    await controller.promoteMembers(
      request({ memberIds: [ID_A], placements: [{ reviewerId: ID_A, teamId: 'nope' }] }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);

    await controller.promoteMembers(
      request({ memberIds: [ID_A], placements: 'not-an-array' }),
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('400s when a placement names a team that does not exist', async () => {
    Team.countDocuments = jest.fn().mockResolvedValue(0);

    await controller.promoteMembers(
      request({ memberIds: [ID_A], placements: [{ reviewerId: ID_A, teamId: TEAM }] }),
      mockRes,
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(savedUser.save).not.toHaveBeenCalled();
  });

  afterEach(() => {
    mongoose.startSession.mockRestore();
  });
});

describe('PR entries and ratings', () => {
  const REVIEWER = '637af0c0fb9bbc1e308cff01';
  const ENTRY = '637af0c0fb9bbc1e308cfe01';

  let PromotionPrEntry;
  let UserProfile;
  let controller;
  let mockRes;

  const request = (body = {}, params = {}) => ({
    params,
    body: { requestor: { requestorId: OWNER_ID, role: 'Administrator' }, ...body },
  });

  const build = () =>
    promotionEligibilityController(
      UserProfile,
      {},
      {},
      { find: jest.fn(), findOneAndUpdate: jest.fn() },
      null,
      null,
      null,
      PromotionPrEntry,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);

    PromotionPrEntry = {
      find: jest.fn(() => ({ sort: () => ({ lean: () => Promise.resolve([]) }) })),
      create: jest.fn().mockImplementation((doc) => Promise.resolve({ _id: ENTRY, ...doc })),
      findByIdAndUpdate: jest.fn().mockResolvedValue({ _id: ENTRY, rating: 'Good' }),
    };
    UserProfile = {
      findById: jest.fn(() => ({ lean: () => Promise.resolve({ weeklySummaries: [] }) })),
    };
    controller = build();

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  const body = () => mockRes.json.mock.calls[0][0];

  describe('getPrRatings', () => {
    it('serves the five spec options so the dropdown cannot drift', async () => {
      await controller.getPrRatings(request(), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(body().ratings.map((r) => r.value)).toEqual([
        'Did not review',
        'Needs more details',
        'Good',
        'Exceptional',
        'No Image',
      ]);
    });

    it('refuses a requestor without getReports', async () => {
      hasPermission.mockResolvedValue(false);
      await controller.getPrRatings(request(), mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('addPrEntry', () => {
    it('normalises the PR number on the way in', async () => {
      await controller.addPrEntry(
        request({ prNumber: 'PR #1234' }, { reviewerId: REVIEWER }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(PromotionPrEntry.create.mock.calls[0][0].prNumber).toBe('1234');
    });

    it('keeps a repo prefix', async () => {
      await controller.addPrEntry(
        request({ prNumber: 'fe 2284' }, { reviewerId: REVIEWER }),
        mockRes,
      );
      expect(PromotionPrEntry.create.mock.calls[0][0].prNumber).toBe('FE-2284');
    });

    it('defaults to the current week when none is given', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-08-19T12:00:00Z'));

      await controller.addPrEntry(request({ prNumber: '1234' }, { reviewerId: REVIEWER }), mockRes);

      expect(PromotionPrEntry.create.mock.calls[0][0]).toMatchObject({ year: 2026, week: 33 });
      jest.useRealTimers();
    });

    it('accepts an explicit week for backfilling', async () => {
      await controller.addPrEntry(
        request({ prNumber: '1234', year: 2025, week: 8 }, { reviewerId: REVIEWER }),
        mockRes,
      );
      expect(PromotionPrEntry.create.mock.calls[0][0]).toMatchObject({ year: 2025, week: 8 });
    });

    it('rejects half a week rather than guessing the other half', async () => {
      await controller.addPrEntry(
        request({ prNumber: '1234', year: 2025 }, { reviewerId: REVIEWER }),
        mockRes,
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(PromotionPrEntry.create).not.toHaveBeenCalled();
    });

    it('rejects an unreadable PR number', async () => {
      await controller.addPrEntry(
        request({ prNumber: 'last weeks one' }, { reviewerId: REVIEWER }),
        mockRes,
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(PromotionPrEntry.create).not.toHaveBeenCalled();
    });

    it('rejects a rating outside the five options', async () => {
      await controller.addPrEntry(
        request({ prNumber: '1234', rating: 'Sufficient' }, { reviewerId: REVIEWER }),
        mockRes,
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('records who rated it when a rating comes in with the entry', async () => {
      await controller.addPrEntry(
        request({ prNumber: '1234', rating: 'Exceptional' }, { reviewerId: REVIEWER }),
        mockRes,
      );
      const doc = PromotionPrEntry.create.mock.calls[0][0];
      expect(doc.rating).toBe('Exceptional');
      expect(doc.ratedBy).toBe(OWNER_ID);
      expect(doc.ratedAt).toBeInstanceOf(Date);
    });

    it('leaves ratedBy unset when the entry arrives unrated', async () => {
      await controller.addPrEntry(request({ prNumber: '1234' }, { reviewerId: REVIEWER }), mockRes);
      const doc = PromotionPrEntry.create.mock.calls[0][0];
      expect(doc.rating).toBeNull();
      expect(doc.ratedBy).toBeNull();
    });

    it('409s on a duplicate rather than failing as a server error', async () => {
      const duplicate = new Error('E11000 duplicate key');
      duplicate.code = 11000;
      PromotionPrEntry.create = jest.fn().mockRejectedValue(duplicate);
      controller = build();

      await controller.addPrEntry(request({ prNumber: '1234' }, { reviewerId: REVIEWER }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });

    it('rejects a malformed reviewer id', async () => {
      await controller.addPrEntry(request({ prNumber: '1234' }, { reviewerId: 'nope' }), mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updatePrEntryRating', () => {
    it('sets a rating', async () => {
      await controller.updatePrEntryRating(
        request({ rating: 'Good' }, { entryId: ENTRY }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const update = PromotionPrEntry.findByIdAndUpdate.mock.calls[0][1].$set;
      expect(update.rating).toBe('Good');
      expect(update.ratedBy).toBe(OWNER_ID);
    });

    it('clears a rating with null and forgets who set it', async () => {
      await controller.updatePrEntryRating(request({ rating: null }, { entryId: ENTRY }), mockRes);

      const update = PromotionPrEntry.findByIdAndUpdate.mock.calls[0][1].$set;
      expect(update.rating).toBeNull();
      expect(update.ratedBy).toBeNull();
      expect(update.ratedAt).toBeNull();
    });

    it('treats a missing rating field as a bad request, not as a clear', async () => {
      await controller.updatePrEntryRating(request({}, { entryId: ENTRY }), mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(PromotionPrEntry.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('404s on an entry that does not exist', async () => {
      PromotionPrEntry.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
      controller = build();

      await controller.updatePrEntryRating(
        request({ rating: 'Good' }, { entryId: ENTRY }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getPrEntries', () => {
    it('groups a reviewer entries by week, newest first', async () => {
      PromotionPrEntry.find = jest.fn(() => ({
        sort: () => ({
          lean: () =>
            Promise.resolve([
              { year: 2026, week: 32, prNumber: '1' },
              { year: 2026, week: 33, prNumber: '2' },
            ]),
        }),
      }));
      controller = build();

      await controller.getPrEntries(request({}, { reviewerId: REVIEWER }), mockRes);

      expect(body().weeks.map((w) => w.week)).toEqual([33, 32]);
    });
  });

  describe('getPrEntriesForReviewers', () => {
    const OTHER_REVIEWER = '637af0c0fb9bbc1e308cff02';

    /** Whatever the caller asks for, the model answers with these entries. */
    const givenEntries = (entries) => {
      PromotionPrEntry.find = jest.fn(() => ({
        sort: () => ({ lean: () => Promise.resolve(entries) }),
      }));
      controller = build();
    };

    it('keys the response by reviewer id', async () => {
      givenEntries([
        { reviewerId: REVIEWER, year: 2026, week: 33, prNumber: '1' },
        { reviewerId: OTHER_REVIEWER, year: 2026, week: 33, prNumber: '2' },
      ]);

      await controller.getPrEntriesForReviewers(
        request({ reviewerIds: [REVIEWER, OTHER_REVIEWER] }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(body().reviewers[REVIEWER].weeks[0].prs[0].prNumber).toBe('1');
      expect(body().reviewers[OTHER_REVIEWER].weeks[0].prs[0].prNumber).toBe('2');
    });

    it('returns a key for a reviewer with no entries, so the caller never handles a missing one', async () => {
      givenEntries([{ reviewerId: REVIEWER, year: 2026, week: 33, prNumber: '1' }]);

      await controller.getPrEntriesForReviewers(
        request({ reviewerIds: [REVIEWER, OTHER_REVIEWER] }),
        mockRes,
      );

      expect(body().reviewers[OTHER_REVIEWER]).toEqual({ weeks: [] });
    });

    it('groups each reviewer newest week first, exactly like the single reviewer route', async () => {
      givenEntries([
        { reviewerId: REVIEWER, year: 2026, week: 32, prNumber: '1' },
        { reviewerId: REVIEWER, year: 2026, week: 33, prNumber: '2' },
      ]);

      await controller.getPrEntriesForReviewers(request({ reviewerIds: [REVIEWER] }), mockRes);

      expect(body().reviewers[REVIEWER].weeks.map((w) => w.week)).toEqual([33, 32]);
    });

    it('reads every reviewer in one query rather than one query each', async () => {
      givenEntries([]);

      await controller.getPrEntriesForReviewers(
        request({ reviewerIds: [REVIEWER, OTHER_REVIEWER] }),
        mockRes,
      );

      expect(PromotionPrEntry.find).toHaveBeenCalledTimes(1);
      expect(PromotionPrEntry.find.mock.calls[0][0].reviewerId.$in).toHaveLength(2);
    });

    it('asks for each reviewer once when the same id is sent twice', async () => {
      givenEntries([]);

      await controller.getPrEntriesForReviewers(
        request({ reviewerIds: [REVIEWER, REVIEWER] }),
        mockRes,
      );

      expect(PromotionPrEntry.find.mock.calls[0][0].reviewerId.$in).toEqual([REVIEWER]);
    });

    it.each([[undefined], [[]], ['not-an-array'], [{}]])(
      'rejects %p as reviewerIds',
      async (reviewerIds) => {
        givenEntries([]);

        await controller.getPrEntriesForReviewers(request({ reviewerIds }), mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(PromotionPrEntry.find).not.toHaveBeenCalled();
      },
    );

    it('names the offending id when one is not a valid ObjectId', async () => {
      givenEntries([]);

      await controller.getPrEntriesForReviewers(
        request({ reviewerIds: [REVIEWER, 'not-an-object-id'] }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send.mock.calls[0][0]).toContain('not-an-object-id');
      expect(PromotionPrEntry.find).not.toHaveBeenCalled();
    });

    it('refuses a batch larger than the whole table rather than building the response', async () => {
      givenEntries([]);
      const tooMany = Array.from({ length: 2001 }, () => REVIEWER);

      await controller.getPrEntriesForReviewers(request({ reviewerIds: tooMany }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(PromotionPrEntry.find).not.toHaveBeenCalled();
    });

    it('refuses a caller without getReports', async () => {
      givenEntries([]);
      hasPermission.mockResolvedValue(false);

      await controller.getPrEntriesForReviewers(request({ reviewerIds: [REVIEWER] }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(PromotionPrEntry.find).not.toHaveBeenCalled();
    });

    it('reports a database failure as a 500 rather than throwing at the router', async () => {
      PromotionPrEntry.find = jest.fn(() => ({
        sort: () => ({ lean: () => Promise.reject(new Error('mongo is down')) }),
      }));
      controller = build();

      await controller.getPrEntriesForReviewers(request({ reviewerIds: [REVIEWER] }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('importPrEntriesFromSummary', () => {
    const givenSummary = (summary, dueDate) => {
      UserProfile.findById = jest.fn(() => ({
        lean: () => Promise.resolve({ weeklySummaries: [{ summary, dueDate }] }),
      }));
      controller = build();
    };

    it('adds the PRs it finds, marked as coming from the summary', async () => {
      givenSummary('Reviewed PR 1234 and #567 this week.', '2026-08-19T00:00:00Z');

      await controller.importPrEntriesFromSummary(request({}, { reviewerId: REVIEWER }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(PromotionPrEntry.create).toHaveBeenCalledTimes(2);
      expect(PromotionPrEntry.create.mock.calls[0][0].source).toBe('weeklySummary');
      expect(body().added).toHaveLength(2);
    });

    it('always warns that the results are guesses', async () => {
      givenSummary('Reviewed PR 1234.', '2026-08-19T00:00:00Z');

      await controller.importPrEntriesFromSummary(request({}, { reviewerId: REVIEWER }), mockRes);

      expect(body().warnings.join(' ')).toContain('suggestions');
    });

    it('dates entries by the summary due date, not by today', async () => {
      givenSummary('PR 1234', '2025-02-19T00:00:00Z');

      await controller.importPrEntriesFromSummary(request({}, { reviewerId: REVIEWER }), mockRes);

      expect(PromotionPrEntry.create.mock.calls[0][0].year).toBe(2025);
    });

    it('reports rather than fails when the summary has no PR numbers', async () => {
      givenSummary('Was on leave this week.', '2026-08-19T00:00:00Z');

      await controller.importPrEntriesFromSummary(request({}, { reviewerId: REVIEWER }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(body().added).toEqual([]);
      expect(body().warnings.join(' ')).toContain('No PR numbers were found');
      expect(PromotionPrEntry.create).not.toHaveBeenCalled();
    });

    it('is safe to run twice: an already-listed PR is skipped, not an error', async () => {
      givenSummary('PR 1234 and PR 5678', '2026-08-19T00:00:00Z');
      const duplicate = new Error('E11000');
      duplicate.code = 11000;
      PromotionPrEntry.create = jest
        .fn()
        .mockRejectedValueOnce(duplicate)
        .mockResolvedValueOnce({ _id: ENTRY, prNumber: '5678' });
      controller = build();

      await controller.importPrEntriesFromSummary(request({}, { reviewerId: REVIEWER }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(body().skipped).toEqual(['1234']);
      expect(body().added).toHaveLength(1);
    });

    it('404s on a reviewer that does not exist', async () => {
      UserProfile.findById = jest.fn(() => ({ lean: () => Promise.resolve(null) }));
      controller = build();

      await controller.importPrEntriesFromSummary(request({}, { reviewerId: REVIEWER }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});

describe('History column', () => {
  const REVIEWER = {
    _id: '637af0c0fb9bbc1e308cff62',
    firstName: 'Ann',
    lastName: 'Adams',
    weeklycommittedHours: 10, // 7 PRs needed
    createdDate: '2020-01-01',
  };

  let TimeEntry;
  let controller;
  let mockRes;

  const NOW = new Date('2026-08-19T12:00:00Z'); // 2026 week 33

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(NOW);
    hasPermission.mockResolvedValue(true);

    TimeEntry = { aggregate: jest.fn().mockResolvedValue([]) };
    controller = promotionEligibilityController(
      { find: jest.fn(() => ({ lean: () => Promise.resolve([REVIEWER]) })) },
      TimeEntry,
      { countDocuments: jest.fn().mockResolvedValue(0) },
      {
        find: jest.fn(() => ({ lean: () => Promise.resolve([]) })),
        findOneAndUpdate: jest.fn().mockResolvedValue({}),
      },
      null,
    );

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => jest.useRealTimers());

  const req = () => ({ body: { requestor: { requestorId: OWNER_ID, role: 'Administrator' } } });
  const entry = () => mockRes.json.mock.calls[0][0][0];

  it('returns one row per prior week, oldest first so it reads left to right', async () => {
    TimeEntry.aggregate.mockResolvedValue([
      { year: 2026, week: 32, reviewCount: 10 },
      { year: 2026, week: 31, reviewCount: 6 },
      { year: 2026, week: 30, reviewCount: 7 },
    ]);

    await controller.getPromotionEligibilityData(req(), mockRes);

    expect(entry().history.map((h) => h.week)).toEqual([30, 31, 32]);
    expect(entry().history.map((h) => h.reviewCount)).toEqual([7, 6, 10]);
  });

  it('flags a week below PRs Needed, which is what the spec colours red', async () => {
    TimeEntry.aggregate.mockResolvedValue([
      { year: 2026, week: 32, reviewCount: 10 },
      { year: 2026, week: 31, reviewCount: 6 },
    ]);

    await controller.getPromotionEligibilityData(req(), mockRes);

    const byWeek = Object.fromEntries(entry().history.map((h) => [h.week, h.belowRequirement]));
    expect(byWeek[31]).toBe(true); // 6 < 7
    expect(byWeek[32]).toBe(false); // 10 >= 7
  });

  it('leaves the current week out, since History is prior weeks', async () => {
    TimeEntry.aggregate.mockResolvedValue([
      { year: 2026, week: 33, reviewCount: 2 },
      { year: 2026, week: 32, reviewCount: 10 },
    ]);

    await controller.getPromotionEligibilityData(req(), mockRes);

    expect(entry().history.map((h) => h.week)).toEqual([32]);
  });

  it('never flags a week red when the requirement is zero', async () => {
    TimeEntry.aggregate.mockResolvedValue([{ year: 2026, week: 32, reviewCount: 0 }]);
    controller = promotionEligibilityController(
      {
        find: jest.fn(() => ({
          lean: () => Promise.resolve([{ ...REVIEWER, weeklycommittedHours: 0 }]),
        })),
      },
      TimeEntry,
      { countDocuments: jest.fn().mockResolvedValue(0) },
      {
        find: jest.fn(() => ({ lean: () => Promise.resolve([]) })),
        findOneAndUpdate: jest.fn().mockResolvedValue({}),
      },
      null,
    );

    await controller.getPromotionEligibilityData(req(), mockRes);

    expect(entry().history[0].belowRequirement).toBe(false);
  });

  it('is an empty array for somebody with no logged review work', async () => {
    await controller.getPromotionEligibilityData(req(), mockRes);
    expect(entry().history).toEqual([]);
  });
});

describe('mongoose ObjectId validation assumption', () => {
  it('treats the ids used above as valid, so the 400 tests fail for the right reason', () => {
    expect(mongoose.Types.ObjectId.isValid(REVIEWER_ID)).toBe(true);
    expect(mongoose.Types.ObjectId.isValid('not-an-object-id')).toBe(false);
  });
});
