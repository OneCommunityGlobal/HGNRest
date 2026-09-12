jest.mock('../utilities/permissions');
jest.mock('../startup/logger');

const mongoose = require('mongoose');
const { hasPermission } = require('../utilities/permissions');
const logger = require('../startup/logger');
const promotionEligibilityControllerFactory = require('./promotionEligibilityController');

describe('promotionEligibilityController', () => {
  let UserProfile;
  let TimeEntry;
  let Task;
  let PromotionEligibility;
  let controller;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();

    UserProfile = {
      find: jest.fn(),
      findById: jest.fn(),
    };
    TimeEntry = { aggregate: jest.fn() };
    Task = { aggregate: jest.fn() };
    PromotionEligibility = {
      bulkWrite: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    controller = promotionEligibilityControllerFactory(
      UserProfile,
      TimeEntry,
      Task,
      PromotionEligibility,
    );

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    mockReq = { body: { requestor: { requestorId: 'requestor1' } } };

    hasPermission.mockResolvedValue(true);
  });

  describe('getPromotionEligibilityData', () => {
    it('returns 403 when the requestor lacks permission', async () => {
      hasPermission.mockResolvedValue(false);

      await controller.getPromotionEligibilityData(mockReq, mockRes);

      expect(hasPermission).toHaveBeenCalledWith(mockReq.body.requestor, 'getReports');
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith(
        'You are not authorized to view promotion eligibility data.',
      );
      expect(UserProfile.find).not.toHaveBeenCalled();
    });

    it('computes eligibility data per user from the batched aggregates and persists a snapshot', async () => {
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

      const users = [
        {
          _id: 'user1',
          firstName: 'Alice',
          lastName: 'Smith',
          weeklycommittedHours: 20,
          createdDate: oldDate,
        },
        {
          _id: 'user2',
          firstName: 'Bob',
          lastName: 'Jones',
          weeklycommittedHours: 10,
          createdDate: recentDate,
        },
      ];

      UserProfile.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(users) });

      // Alice: one week meets her 10hr/week threshold (pledgedHours/2), one week doesn't.
      TimeEntry.aggregate.mockResolvedValue([
        { _id: { personId: 'user1', week: 1 }, totalHours: 12 },
        { _id: { personId: 'user1', week: 2 }, totalHours: 3 },
      ]);

      Task.aggregate.mockResolvedValue([{ _id: 'user1', totalReviews: 5 }]);
      PromotionEligibility.bulkWrite.mockResolvedValue({});

      await controller.getPromotionEligibilityData(mockReq, mockRes);

      expect(UserProfile.find).toHaveBeenCalledWith(
        { isActive: true, role: { $nin: ['Owner', 'Administrator', 'Promoted Reviewer'] } },
        '_id firstName lastName weeklycommittedHours createdDate',
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);

      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData).toHaveLength(2);

      const alice = responseData.find((r) => r.reviewerId === 'user1');
      expect(alice.reviewerName).toBe('Alice Smith');
      expect(alice.pledgedHours).toBe(20);
      expect(alice.requiredPRs).toBe(10);
      expect(alice.totalReviews).toBe(5);
      expect(alice.remainingWeeks).toBe(1);
      expect(alice.weeklyRequirementsMet).toBe(false);
      expect(alice.isNewMember).toBe(false);

      const bob = responseData.find((r) => r.reviewerId === 'user2');
      expect(bob.totalReviews).toBe(0);
      expect(bob.remainingWeeks).toBe(2);
      expect(bob.weeklyRequirementsMet).toBe(false);
      expect(bob.isNewMember).toBe(true);

      // bulkWrite is fire-and-forget, so flush microtasks before asserting on it.
      await new Promise(setImmediate);
      expect(PromotionEligibility.bulkWrite).toHaveBeenCalledTimes(1);
      const bulkOps = PromotionEligibility.bulkWrite.mock.calls[0][0];
      expect(bulkOps).toHaveLength(2);
      expect(bulkOps[0].updateOne.upsert).toBe(true);
    });

    it('responds with an empty array and skips bulkWrite when there are no eligible users', async () => {
      UserProfile.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      TimeEntry.aggregate.mockResolvedValue([]);
      Task.aggregate.mockResolvedValue([]);

      await controller.getPromotionEligibilityData(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
      expect(PromotionEligibility.bulkWrite).not.toHaveBeenCalled();
    });

    it('logs but does not fail the response when the snapshot bulkWrite rejects', async () => {
      const users = [
        {
          _id: 'user1',
          firstName: 'A',
          lastName: 'B',
          weeklycommittedHours: 10,
          createdDate: new Date(),
        },
      ];
      UserProfile.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(users) });
      TimeEntry.aggregate.mockResolvedValue([]);
      Task.aggregate.mockResolvedValue([]);
      const bulkWriteError = new Error('bulk write failed');
      PromotionEligibility.bulkWrite.mockRejectedValue(bulkWriteError);

      await controller.getPromotionEligibilityData(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);

      await new Promise(setImmediate);
      expect(logger.logException).toHaveBeenCalledWith(bulkWriteError, {
        endpoint: 'getPromotionEligibilityData:bulkWrite',
      });
    });

    it('returns 500 when an unexpected error is thrown', async () => {
      const dbError = new Error('db down');
      UserProfile.find.mockImplementation(() => {
        throw dbError;
      });

      await controller.getPromotionEligibilityData(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith('Error fetching promotion eligibility data.');
      expect(logger.logException).toHaveBeenCalledWith(dbError, {
        endpoint: 'getPromotionEligibilityData',
      });
    });
  });

  describe('promoteMembers', () => {
    let mockSession;

    beforeEach(() => {
      mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        abortTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns 403 when the requestor lacks permission', async () => {
      hasPermission.mockResolvedValue(false);
      mockReq.body.memberIds = ['507f1f77bcf86cd799439011'];

      await controller.promoteMembers(mockReq, mockRes);

      expect(hasPermission).toHaveBeenCalledWith(mockReq.body.requestor, 'putUserProfile');
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 when memberIds is missing or empty', async () => {
      mockReq.body.memberIds = [];

      await controller.promoteMembers(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith('No member IDs provided for promotion.');
    });

    it('promotes a valid member and commits the transaction', async () => {
      const memberId = '507f1f77bcf86cd799439011';
      mockReq.body.memberIds = [memberId];

      const mockUser = {
        firstName: 'Alice',
        lastName: 'Smith',
        role: 'Volunteer',
        save: jest.fn().mockResolvedValue(undefined),
      };
      UserProfile.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(mockUser) });
      PromotionEligibility.findOneAndUpdate.mockResolvedValue({});

      await controller.promoteMembers(mockReq, mockRes);

      expect(mockUser.role).toBe('Promoted Reviewer');
      expect(mockUser.save).toHaveBeenCalledWith({ session: mockSession });
      expect(PromotionEligibility.findOneAndUpdate).toHaveBeenCalledWith(
        { reviewerId: memberId },
        { $set: { isPromoted: true, promotionDate: expect.any(Date) } },
        { new: true, session: mockSession },
      );
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Members promoted successfully.',
        promotedMembers: [{ id: memberId, name: 'Alice Smith' }],
      });
    });

    it('skips a non-existent member without failing the transaction', async () => {
      const memberId = '507f1f77bcf86cd799439011';
      mockReq.body.memberIds = [memberId];
      UserProfile.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });

      await controller.promoteMembers(mockReq, mockRes);

      expect(logger.logInfo).toHaveBeenCalledWith(
        `Attempted to promote non-existent user with ID: ${memberId}`,
      );
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('returns 400 and aborts the transaction for an invalid member id', async () => {
      mockReq.body.memberIds = ['not-a-valid-id'];

      await controller.promoteMembers(mockReq, mockRes);

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Invalid member ID: not-a-valid-id' });
    });

    it('returns 500 and aborts the transaction on an unexpected error', async () => {
      const memberId = '507f1f77bcf86cd799439011';
      mockReq.body.memberIds = [memberId];
      const dbError = new Error('db failure');
      UserProfile.findById.mockReturnValue({ session: jest.fn().mockRejectedValue(dbError) });

      await controller.promoteMembers(mockReq, mockRes);

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith('Error promoting members.');
    });
  });
});
