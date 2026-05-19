const Role = require('../models/role');
const UserProfile = require('../models/userProfile');
const { hasPermission } = require('./permissions');

// 1. Setup Mocks
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

// Helper to handle Mongoose's chainable API: .select().lean().exec()
const mockMongooseChain = (value) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe('hasPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Explicitly re-mocking findById and findOne to ensure Jest sees them as mock functions
    UserProfile.findById = jest.fn();
    Role.findOne = jest.fn();
  });

  it('accepts a requestor passed as a user id string', async () => {
    UserProfile.findById
      .mockImplementationOnce(() => mockMongooseChain({ role: 'Administrator' }))
      .mockImplementationOnce(() => mockMongooseChain({ permissions: { removedDefaultPermissions: [] } }))
      .mockImplementationOnce(() => mockMongooseChain({ permissions: { frontPermissions: [] } }));

    Role.findOne.mockImplementation(() => mockMongooseChain({ permissions: ['addInfringements'] }));

    const result = await hasPermission('690cd7fd078096082baa8061', 'addInfringements');

    expect(result).toBe(true);
    expect(UserProfile.findById).toHaveBeenNthCalledWith(1, '690cd7fd078096082baa8061');
    expect(Role.findOne).toHaveBeenCalledWith({ roleName: 'Administrator' });
  });

  it('returns false when a string requestor cannot be resolved', async () => {
    UserProfile.findById.mockImplementationOnce(() => mockMongooseChain(null));

    const result = await hasPermission('690cd7fd078096082baa8061', 'addInfringements');

    expect(result).toBe(false);
    expect(Role.findOne).not.toHaveBeenCalled();
  });

  it('accepts a requestor object with only requestorId by resolving the role from the database', async () => {
    UserProfile.findById
      .mockImplementationOnce(() => mockMongooseChain({ role: 'Manager' }))
      .mockImplementationOnce(() => mockMongooseChain({ permissions: { removedDefaultPermissions: [] } }))
      .mockImplementationOnce(() => mockMongooseChain({ permissions: { frontPermissions: [] } }));

    Role.findOne.mockImplementation(() => mockMongooseChain({ permissions: ['addInfringements'] }));

    const result = await hasPermission(
      { requestorId: '690cd7fd078096082baa8061' },
      'addInfringements',
    );

    expect(result).toBe(true);
    expect(UserProfile.findById).toHaveBeenNthCalledWith(1, '690cd7fd078096082baa8061');
    expect(Role.findOne).toHaveBeenCalledWith({ roleName: 'Manager' });
  });

  it('accepts legacy requestor objects that use _id', async () => {
    UserProfile.findById
      .mockImplementationOnce(() => mockMongooseChain({ role: 'Owner' }))
      .mockImplementationOnce(() => mockMongooseChain({ permissions: { removedDefaultPermissions: [] } }))
      .mockImplementationOnce(() => mockMongooseChain({ permissions: { frontPermissions: [] } }));

    Role.findOne.mockImplementation(() => mockMongooseChain({ permissions: ['addInfringements'] }));

    const result = await hasPermission({ _id: '690cd7fd078096082baa8061' }, 'addInfringements');

    expect(result).toBe(true);
    expect(UserProfile.findById).toHaveBeenNthCalledWith(1, '690cd7fd078096082baa8061');
    expect(Role.findOne).toHaveBeenCalledWith({ roleName: 'Owner' });
  });
});