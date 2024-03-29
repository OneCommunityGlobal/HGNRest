// const mongoose = require('mongoose');
// const UserProfile = require('../models/userProfile');
const Badge = require('../models/badge');
const helper = require('../utilities/permissions');
// const escapeRegex = require('../utilities/escapeRegex');
const badgeController = require('./badgeController');
const { mockReq, mockRes, assertResMock } = require('../test');

// mock the cache function before importing so we can manipulate the implementation
// jest.mock('../utilities/nodeCache');
// const cache = require('../utilities/nodeCache');

const makeSut = () => {
  const { postBadge } = badgeController(Badge);

  return { postBadge };
};

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

// const makeMockCache = (method, value) => {
//   const cacheObject = {
//     getCache: () => {},
//     removeCache: () => {},
//     hasCache: () => {},
//     setCache: () => {},
//   };

//   const mockCache = jest.spyOn(cacheObject, method).mockImplementation(() => value);

//   cache.mockImplementation(() => cacheObject);

//   return mockCache;
// };

describe('badeController module', () => {
  beforeEach(() => {
    mockReq.body.badgeName = 'random badge';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postBadge method', () => {
    test('Returns 403 if the user does not have badge permissions', async () => {
      const { postBadge } = makeSut();

      const hasPermissionSpy = mockHasPermission(false);

      const response = await postBadge(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createBadges');
      assertResMock(
        403,
        {
          error: 'You are not authorized to create new badges.',
        },
        response,
        mockRes,
      );
    });
  });
});
