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

describe('mongoose ObjectId validation assumption', () => {
  it('treats the ids used above as valid, so the 400 tests fail for the right reason', () => {
    expect(mongoose.Types.ObjectId.isValid(REVIEWER_ID)).toBe(true);
    expect(mongoose.Types.ObjectId.isValid('not-an-object-id')).toBe(false);
  });
});
