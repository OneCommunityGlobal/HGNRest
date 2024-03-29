// const mongoose = require('mongoose');
// const UserProfile = require('../models/userProfile');
const Badge = require('../models/badge');
const helper = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');
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
    mockReq.body.category = 'Food';
    mockReq.body.type = 'No Infringement Streak';
    mockReq.body.multiple = 3;
    mockReq.body.totalHrs = 55;
    mockReq.body.weeks = 1;
    mockReq.body.months = 2;
    mockReq.body.people = 10;
    mockReq.body.project = '601acda376045c7879d13a74';
    mockReq.body.imageUrl = 'https://randomURL.com';
    mockReq.body.ranking = 3;
    mockReq.body.description = 'Any description';
    mockReq.body.showReport = true;
    mockReq.params.badgeId = '5a7ccd20fde60f1f1857ba16';
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

    test('Returns 400 if another badge with name already exists', async () => {
      const { postBadge } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const badgeArray = [{ badgeName: 'asdf' }];

      const findSpy = jest
        .spyOn(Badge, 'find')
        .mockImplementationOnce(() => Promise.resolve(badgeArray));

      const response = await postBadge(mockReq, mockRes);

      expect(findSpy).toHaveBeenCalledWith({
        badgeName: { $regex: escapeRegex(mockReq.body.badgeName), $options: 'i' },
      });

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createBadges');

      assertResMock(
        400,
        {
          error: `Another badge with name ${badgeArray[0].badgeName} already exists. Sorry, but badge names should be like snowflakes, no two should be the same. Please choose a different name for this badge so it can be proudly unique.`,
        },
        response,
        mockRes,
      );
    });

    test('Returns 500 if any error occurs when finding a badge', async () => {
      const { postBadge } = makeSut();
      const errorMsg = 'Error when finding badge';
      const hasPermissionSpy = mockHasPermission(true);

      jest.spyOn(Badge, 'find').mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));

      const response = await postBadge(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createBadges');
      assertResMock(500, new Error(errorMsg), response, mockRes);
    });

    test('Returns 500 if any error occurs when saving the new badge', async () => {
      const { postBadge } = makeSut();
      const errorMsg = 'Error when saving badge';
      const hasPermissionSpy = mockHasPermission(true);

      const findSpy = jest.spyOn(Badge, 'find').mockImplementationOnce(() => Promise.resolve([]));

      jest
        .spyOn(Badge.prototype, 'save')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));

      const response = await postBadge(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createBadges');
      expect(findSpy).toHaveBeenCalledWith({
        badgeName: { $regex: escapeRegex(mockReq.body.badgeName), $options: 'i' },
      });
      assertResMock(500, new Error(errorMsg), response, mockRes);
    });

    test('Returns 201 if a badge is succesfully created.', async () => {
      const { postBadge } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

      const findSpy = jest.spyOn(Badge, 'find').mockImplementationOnce(() => Promise.resolve([]));

      const newBadge = {
        badgeName: mockReq.body.badgeName,
        category: mockReq.body.category,
        multiple: mockReq.body.multiple,
        totalHrs: mockReq.body.totalHrs,
        weeks: mockReq.body.weeks,
        months: mockReq.body.months,
        people: mockReq.body.people,
        project: mockReq.body.project,
        imageUrl: mockReq.body.imageUrl,
        ranking: mockReq.body.ranking,
        description: mockReq.body.description,
        showReport: mockReq.body.showReport,
      };

      jest.spyOn(Badge.prototype, 'save').mockImplementationOnce(() => Promise.resolve(newBadge));

      const response = await postBadge(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createBadges');
      expect(findSpy).toHaveBeenCalledWith({
        badgeName: { $regex: escapeRegex(mockReq.body.badgeName), $options: 'i' },
      });
      assertResMock(201, newBadge, response, mockRes);
    });
  });
});
