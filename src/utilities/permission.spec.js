const { PROTECTED_EMAIL_ACCOUNT } = require('./constants');
const { canRequestorUpdateUser } = require('./permissions');
const userService = require('../services/userService');

// Mock modules
jest.mock('../startup/logger', () => ({
  logException: jest.fn(),
  logInfo: jest.fn(), // Add any other mocked methods if needed
}));
jest.mock('../services/userService');
jest.mock('./nodeCache', () =>
  jest.fn().mockImplementation(() => ({
    hasCache: jest.fn(),
    getCache: jest.fn(),
    setCache: jest.fn(),
  })),
);

// Mock function return
const mockGetUserIdAndEmailByEmails = (value) =>
  jest
    .spyOn(userService, 'getUserIdAndEmailByEmails')
    .mockImplementationOnce(() => Promise.resolve(value));

describe('canRequestorUpdateUser', () => {
  let serverCache;

  beforeEach(() => {
    jest.clearAllMocks();
    serverCache = require('./nodeCache')();
  });

  it('should return true if requestorId is not in protectedEmailAccountIds and targetUserId is also not in protectedEmailAccountIds', async () => {
    serverCache.hasCache.mockReturnValue(false);
    mockGetUserIdAndEmailByEmails([
      { _id: 'protectedUserId_1', email: PROTECTED_EMAIL_ACCOUNT[0] },
      { _id: 'protectedUserId_2', email: PROTECTED_EMAIL_ACCOUNT[1] },
      { _id: 'protectedUserId_3', email: PROTECTED_EMAIL_ACCOUNT[2] },
      { _id: 'protectedUserId_4', email: PROTECTED_EMAIL_ACCOUNT[3] },
    ]);

    const result = await canRequestorUpdateUser('nonProctedId_1', 'nonProctedId_2');
    expect(result).toBe(true);
  });

  it('should return true if requestorId is in protectedEmailAccountIds and targetUserId is also in protectedEmailAccountIds', async () => {
    serverCache.hasCache.mockReturnValue(false);
    mockGetUserIdAndEmailByEmails([
      { _id: 'protectedUserId_1', email: PROTECTED_EMAIL_ACCOUNT[0] },
      { _id: 'protectedUserId_2', email: PROTECTED_EMAIL_ACCOUNT[1] },
      { _id: 'protectedUserId_3', email: PROTECTED_EMAIL_ACCOUNT[2] },
      { _id: 'protectedUserId_4', email: PROTECTED_EMAIL_ACCOUNT[3] },
    ]);

    const result = await canRequestorUpdateUser('protectedUserId_1', 'protectedUserId_2');
    expect(result).toBe(true);
  });

  it('should return false if requestorId is not in protectedEmailAccountIds and targetUserId is in protectedEmailAccountIds', async () => {
    serverCache.hasCache.mockReturnValue(false);
    mockGetUserIdAndEmailByEmails([
      { _id: 'protectedUserId_1', email: PROTECTED_EMAIL_ACCOUNT[0] },
      { _id: 'protectedUserId_2', email: PROTECTED_EMAIL_ACCOUNT[1] },
      { _id: 'protectedUserId_3', email: PROTECTED_EMAIL_ACCOUNT[2] },
      { _id: 'protectedUserId_4', email: PROTECTED_EMAIL_ACCOUNT[3] },
    ]);

    const result = await canRequestorUpdateUser('nonProctedId_1', 'protectedUserId_2');
    expect(result).toBe(false);
  });

  it('should return true if requestorId is in protectedEmailAccountIds and targetUserId is not in protectedEmailAccountIds', async () => {
    serverCache.hasCache.mockReturnValue(false);
    mockGetUserIdAndEmailByEmails([
      { _id: 'protectedUserId_1', email: PROTECTED_EMAIL_ACCOUNT[0] },
      { _id: 'protectedUserId_2', email: PROTECTED_EMAIL_ACCOUNT[1] },
      { _id: 'protectedUserId_3', email: PROTECTED_EMAIL_ACCOUNT[2] },
      { _id: 'protectedUserId_4', email: PROTECTED_EMAIL_ACCOUNT[3] },
    ]);

    const result = await canRequestorUpdateUser('protectedUserId_2', 'nonProctedId_1');
    expect(result).toBe(true);
  });
});
