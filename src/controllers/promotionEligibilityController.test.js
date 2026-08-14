jest.mock('../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

const mongoose = require('mongoose');
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

describe('mongoose ObjectId validation assumption', () => {
  it('treats the ids used above as valid, so the 400 tests fail for the right reason', () => {
    expect(mongoose.Types.ObjectId.isValid(REVIEWER_ID)).toBe(true);
    expect(mongoose.Types.ObjectId.isValid('not-an-object-id')).toBe(false);
  });
});
