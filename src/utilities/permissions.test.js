jest.mock('../models/role', () => ({
  findOne: jest.fn(),
}));

jest.mock('../models/userProfile', () => ({
  findById: jest.fn(),
}));

const mockServerCache = {
  hasCache: jest.fn(() => false),
  getCache: jest.fn(),
  setCache: jest.fn(),
  setKeyTimeToLive: jest.fn(),
};

jest.mock('./nodeCache', () => jest.fn(() => mockServerCache));

jest.mock('../services/userService', () => ({
  getUserIdAndEmailByEmails: jest.fn(),
}));

jest.mock('../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

const Role = require('../models/role');
const UserProfile = require('../models/userProfile');
const userService = require('../services/userService');
const { hasPermission, canRequestorUpdateUser } = require('./permissions');
const { PROTECTED_EMAIL_ACCOUNT, ALLOWED_EMAIL_ACCOUNT } = require('./constants');

const makeExecResult = (value) => ({
  exec: jest.fn().mockResolvedValue(value),
});

const mockUserProfileLookups = (role) => {
  UserProfile.findById
    .mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        lean: jest.fn(() => makeExecResult({ role })),
      })),
    }))
    .mockImplementationOnce(() => ({
      select: jest.fn(() =>
        makeExecResult({
          permissions: { removedDefaultPermissions: [] },
        }),
      ),
    }))
    .mockImplementationOnce(() => ({
      select: jest.fn(() =>
        makeExecResult({
          permissions: { frontPermissions: [] },
        }),
      ),
    }));
};

const mockRolePermission = () => {
  Role.findOne.mockImplementation(() =>
    makeExecResult({
      permissions: ['addInfringements'],
    }),
  );
};

describe('hasPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a requestor passed as a user id string', async () => {
    mockUserProfileLookups('Administrator');
    mockRolePermission();

    const result = await hasPermission('690cd7fd078096082baa8061', 'addInfringements');

    expect(result).toBe(true);
    expect(UserProfile.findById).toHaveBeenNthCalledWith(1, '690cd7fd078096082baa8061');
    expect(Role.findOne).toHaveBeenCalledWith({
      roleName: 'Administrator',
    });
  });

  it('returns false when a string requestor cannot be resolved', async () => {
    UserProfile.findById.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        lean: jest.fn(() => makeExecResult(null)),
      })),
    }));

    const result = await hasPermission('690cd7fd078096082baa8061', 'addInfringements');

    expect(result).toBe(false);
    expect(Role.findOne).not.toHaveBeenCalled();
  });

  it('accepts a requestor object with only requestorId by resolving the role from the database', async () => {
    mockUserProfileLookups('Manager');
    mockRolePermission();

    const result = await hasPermission(
      { requestorId: '690cd7fd078096082baa8061' },
      'addInfringements',
    );

    expect(result).toBe(true);
    expect(UserProfile.findById).toHaveBeenNthCalledWith(1, '690cd7fd078096082baa8061');
    expect(Role.findOne).toHaveBeenCalledWith({
      roleName: 'Manager',
    });
  });

  it('accepts legacy requestor objects that use _id', async () => {
    mockUserProfileLookups('Owner');
    mockRolePermission();

    const result = await hasPermission({ _id: '690cd7fd078096082baa8061' }, 'addInfringements');

    expect(result).toBe(true);
    expect(UserProfile.findById).toHaveBeenNthCalledWith(1, '690cd7fd078096082baa8061');
    expect(Role.findOne).toHaveBeenCalledWith({
      roleName: 'Owner',
    });
  });
});
describe('canRequestorUpdateUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('denies access when protected-account lookup returns no accounts', async () => {
    userService.getUserIdAndEmailByEmails.mockResolvedValueOnce([]);

    const result = await canRequestorUpdateUser('unauthorized-user-id', 'protected-user-id');

    expect(result).toBe(false);
  });
  it('denies access when protected-account lookup fails', async () => {
    userService.getUserIdAndEmailByEmails.mockRejectedValueOnce(new Error('Database unavailable'));

    const result = await canRequestorUpdateUser('unauthorized-user-id', 'protected-user-id');

    expect(result).toBe(false);
    expect(userService.getUserIdAndEmailByEmails).toHaveBeenCalled();
  });
  it('denies access when cached protected-account lists are empty', async () => {
    mockServerCache.hasCache.mockReturnValue(true);
    mockServerCache.getCache.mockReturnValue([]);

    const result = await canRequestorUpdateUser('unauthorized-user-id', 'protected-user-id');

    expect(result).toBe(false);
    expect(userService.getUserIdAndEmailByEmails).not.toHaveBeenCalled();
  });
  it('denies access when protected-account lookup is incomplete', async () => {
    mockServerCache.hasCache.mockReturnValue(false);
    UserProfile.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            email: PROTECTED_EMAIL_ACCOUNT[0],
          }),
        }),
      }),
    });

    userService.getUserIdAndEmailByEmails.mockResolvedValueOnce([
      {
        _id: 'known-protected-id',
        email: 'devadmin@hgn.net',
      },
    ]);

    const result = await canRequestorUpdateUser('unauthorized-user-id', 'missing-protected-id');

    expect(result).toBe(false);
  });
  it('allows an authorized protected account to update another protected account', async () => {
    mockServerCache.hasCache.mockReturnValue(false);

    const emails = [...new Set([...PROTECTED_EMAIL_ACCOUNT, ...ALLOWED_EMAIL_ACCOUNT])];

    const accounts = emails.map((email, index) => ({
      _id:
        email === ALLOWED_EMAIL_ACCOUNT[0]
          ? 'authorized-requestor-id'
          : email === PROTECTED_EMAIL_ACCOUNT[1]
            ? 'protected-target-id'
            : `other-account-${index}`,
      email,
    }));

    userService.getUserIdAndEmailByEmails.mockResolvedValueOnce(accounts);

    const result = await canRequestorUpdateUser('authorized-requestor-id', 'protected-target-id');

    expect(result).toBe(true);
  });
  it('denies access when cached protected-account IDs are incomplete', async () => {
    mockServerCache.hasCache.mockReturnValue(true);
    UserProfile.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            email: PROTECTED_EMAIL_ACCOUNT[0],
          }),
        }),
      }),
    });

    mockServerCache.getCache.mockImplementation((key) => {
      if (key === 'protectedEmailAccountIds') {
        return ['other-protected-id'];
      }
      if (key === 'allowedEmailAccountIds') {
        return ['authorized-requestor-id'];
      }
      return null;
    });

    const result = await canRequestorUpdateUser('unauthorized-user-id', 'missing-protected-id');

    expect(result).toBe(false);
  });
  it('allows updates to ordinary accounts with valid cached protection data', async () => {
    mockServerCache.hasCache.mockReturnValue(true);

    mockServerCache.getCache.mockImplementation((key) => {
      if (key === 'protectedEmailAccountIds') {
        return ['known-protected-id'];
      }
      if (key === 'allowedEmailAccountIds') {
        return ['authorized-requestor-id'];
      }
      return null;
    });

    UserProfile.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            email: 'ordinary-user@example.com',
          }),
        }),
      }),
    });

    const result = await canRequestorUpdateUser('ordinary-requestor-id', 'ordinary-target-id');

    expect(result).toBe(true);
  });
});
