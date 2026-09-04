jest.mock('../models/role', () => ({
  findOne: jest.fn(),
}));

jest.mock('../models/userProfile', () => ({
  findById: jest.fn(),
}));

jest.mock('./nodeCache', () =>
  jest.fn(() => ({
    hasCache: jest.fn(() => false),
    getCache: jest.fn(),
    setCache: jest.fn(),
    setKeyTimeToLive: jest.fn(),
  })),
);

jest.mock('../services/userService', () => ({
  getUserIdAndEmailByEmails: jest.fn(),
}));

jest.mock('../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

const Role = require('../models/role');
const UserProfile = require('../models/userProfile');
const { hasPermission } = require('./permissions');

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
