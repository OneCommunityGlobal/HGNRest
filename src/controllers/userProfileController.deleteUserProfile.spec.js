jest.mock('../helpers/userHelper', () => () => ({}));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));
jest.mock('../models/timeentry', () => ({}));
jest.mock('../models/team', () => ({
  collection: {
    updateMany: jest.fn(),
  },
}));
jest.mock('../models/badge', () => ({}));
jest.mock('../utilities/nodeCache', () =>
  jest.fn(() => ({
    removeCache: jest.fn(),
    getCache: jest.fn(() => null),
    setCache: jest.fn(),
  })),
);
jest.mock('../models/followUp', () => ({
  findOneAndDelete: jest.fn(),
}));
jest.mock('../models/task', () => ({
  collection: {
    updateMany: jest.fn(),
  },
}));
jest.mock('../models/hgnFormResponse', () => ({}));
jest.mock('../services/userService', () => ({}));
jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
  canRequestorUpdateUser: jest.fn(),
}));
jest.mock('../utilities/emailSender', () => jest.fn());
jest.mock('../utilities/objectUtils', () => ({
  deepCopyMongooseObjectWithLodash: jest.fn((value) => value),
}));
jest.mock('../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));
jest.mock('./reportsController', () => () => ({}));

const mongoose = require('mongoose');
const Team = require('../models/team');
const Task = require('../models/task');
const followUp = require('../models/followUp');
const { hasPermission, canRequestorUpdateUser } = require('../utilities/permissions');
const userProfileController = require('./userProfileController');

describe('userProfileController deleteUserProfile', () => {
  const userId = '65cf6c3706d8ac105827bb2e';
  const mockUserProfileModel = {
    findById: jest.fn(),
    deleteOne: jest.fn(),
  };
  let mockReq;
  let mockRes;

  const makeSut = () => userProfileController(mockUserProfileModel, {});

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
    canRequestorUpdateUser.mockResolvedValue(true);
    mockUserProfileModel.findById.mockResolvedValue({
      _id: userId,
      email: 'volunteer@example.org',
    });
    mockUserProfileModel.deleteOne.mockResolvedValue({ deletedCount: 1 });
    followUp.findOneAndDelete.mockResolvedValue({});
    Task.collection.updateMany.mockResolvedValue({ modifiedCount: 1 });
    Team.collection.updateMany.mockResolvedValue({ modifiedCount: 1 });
    mockReq = {
      body: {
        userId,
        option: 'delete',
        role: 'Volunteer',
        requestor: {
          requestorId: '507f1f77bcf86cd799439011',
        },
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  test('removes deleted users from tasks and teams using both string and ObjectId matches', async () => {
    const { deleteUserProfile } = makeSut();

    await deleteUserProfile(mockReq, mockRes);

    const expectedObjectId = new mongoose.Types.ObjectId(userId);
    const expectedMatchedUserIds = [userId, expectedObjectId];

    expect(mockUserProfileModel.deleteOne).toHaveBeenCalledWith({ _id: userId });
    expect(followUp.findOneAndDelete).toHaveBeenCalledWith({ userId });
    expect(Task.collection.updateMany).toHaveBeenCalledWith(
      { 'resources.userID': { $in: expectedMatchedUserIds } },
      { $pull: { resources: { userID: { $in: expectedMatchedUserIds } } } },
    );
    expect(Team.collection.updateMany).toHaveBeenCalledWith(
      { 'members.userId': { $in: expectedMatchedUserIds } },
      { $pull: { members: { userId: { $in: expectedMatchedUserIds } } } },
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalledWith({ message: 'Executed Successfully' });
  });
});
