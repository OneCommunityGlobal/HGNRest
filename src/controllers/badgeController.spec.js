// const mongoose = require('mongoose');
// const UserProfile = require('../models/userProfile');
const mongoose = require('mongoose');
const Badge = require('../models/badge');
const helper = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');
const badgeController = require('./badgeController');
const { mockReq, mockRes, assertResMock } = require('../test');
const UserProfile = require('../models/userProfile');

// mock the cache function before importing so we can manipulate the implementation
jest.mock('../utilities/nodeCache');
const cache = require('../utilities/nodeCache');

const makeSut = () => {
  const { postBadge, getAllBadges, assignBadges, deleteBadge } = badgeController(Badge);

  return { postBadge, getAllBadges, assignBadges, deleteBadge };
};

const flushPromises = () => new Promise(setImmediate);

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

const makeMockCache = (method, value) => {
  const cacheObject = {
    getCache: jest.fn(),
    removeCache: jest.fn(),
    hasCache: jest.fn(),
    setCache: jest.fn(),
  };

  const mockCache = jest.spyOn(cacheObject, method).mockImplementationOnce(() => value);

  cache.mockImplementationOnce(() => cacheObject);

  return { mockCache, cacheObject };
};

describe('badeController module', () => {
  beforeEach(() => {
    mockReq.params.badgeId = '601acda376045c7879d13a75';
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
    mockReq.body.badgeCollection = [
      {
        badge: '609c930f7d8f8086e72c501a', // Example ObjectId for badge
        count: 5,
        earnedDate: ['2023-01-01', '2023-02-15'],
        lastModified: new Date('2023-02-15'),
        hasBadgeDeletionImpact: true,
        featured: false,
      },
      {
        badge: '609c930f7d8f8086e72c501b', // Example ObjectId for badge
        count: 10,
        earnedDate: ['2023-03-20'],
        lastModified: new Date('2023-03-20'),
        hasBadgeDeletionImpact: false,
        featured: true,
      },
      {
        badge: '609c930f7d8f8086e72c501c', // Example ObjectId for badge
        count: 3,
        earnedDate: [],
        lastModified: new Date('2023-04-05'),
        hasBadgeDeletionImpact: true,
        featured: false,
      },
    ];
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

    test('Returns 201 if a badge is succesfully created and no badges in cache.', async () => {
      const { mockCache: getCacheMock } = makeMockCache('getCache', '');
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

      expect(getCacheMock).toHaveBeenCalledWith('allBadges');
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createBadges');
      expect(findSpy).toHaveBeenCalledWith({
        badgeName: { $regex: escapeRegex(mockReq.body.badgeName), $options: 'i' },
      });
      assertResMock(201, newBadge, response, mockRes);
    });

    test('Clears cache if all is successful and there is a badge cache', async () => {
      const { mockCache: getCacheMock, cacheObject } = makeMockCache('getCache', '[{_id: 1}]');
      const removeCacheMock = jest
        .spyOn(cacheObject, 'removeCache')
        .mockImplementationOnce(() => null);
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

      expect(getCacheMock).toHaveBeenCalledWith('allBadges');
      expect(removeCacheMock).toHaveBeenCalledWith('allBadges');
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createBadges');
      expect(findSpy).toHaveBeenCalledWith({
        badgeName: { $regex: escapeRegex(mockReq.body.badgeName), $options: 'i' },
      });
      assertResMock(201, newBadge, response, mockRes);
    });
  });

  describe('getAllBadges method', () => {
    const findObject = { populate: () => {} };
    const populateObject = { sort: () => {} };
    test('Returns 403 if the user is not authorized', async () => {
      const { getAllBadges } = makeSut();

      const mockPermission = mockHasPermission(false);
      getAllBadges(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith('You are not authorized to view all badge data.');
      expect(mockPermission).toHaveBeenCalledWith(mockReq.body.requestor, 'seeBadges');
    });

    test('Returns 500 if an error occurs when querying DB', async () => {
      const { mockCache: hasCacheMock } = makeMockCache('hasCache', false);
      const { getAllBadges } = makeSut();
      const mockPermission = mockHasPermission(true);
      const errorMsg = 'Error when finding badges';

      const findMock = jest.spyOn(Badge, 'find').mockImplementationOnce(() => findObject);
      const populateMock = jest
        .spyOn(findObject, 'populate')
        .mockImplementationOnce(() => populateObject);
      const sortMock = jest
        .spyOn(populateObject, 'sort')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));

      getAllBadges(mockReq, mockRes);
      await flushPromises();

      expect(hasCacheMock).toHaveBeenCalledWith('allBadges');
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(new Error(errorMsg));
      expect(mockPermission).toHaveBeenCalledWith(mockReq.body.requestor, 'seeBadges');
      expect(findMock).toHaveBeenCalledWith(
        {},
        'badgeName type multiple weeks months totalHrs people imageUrl category project ranking description showReport',
      );
      expect(populateMock).toHaveBeenCalledWith({
        path: 'project',
        select: '_id projectName',
      });
      expect(sortMock).toHaveBeenCalledWith({
        ranking: 1,
        badgeName: 1,
      });
    });

    test('Returns 200 if the badges are in cache', async () => {
      const badges = [{ badge: 'random badge' }];
      const { mockCache: hasCacheMock, cacheObject } = makeMockCache('hasCache', true);
      const getCacheMock = jest.spyOn(cacheObject, 'getCache').mockReturnValueOnce(badges);

      const { getAllBadges } = makeSut();

      const mockPermission = mockHasPermission(true);

      const response = await getAllBadges(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, badges, response, mockRes);
      expect(hasCacheMock).toHaveBeenCalledWith('allBadges');
      expect(getCacheMock).toHaveBeenCalledWith('allBadges');
      expect(mockPermission).toHaveBeenCalledWith(mockReq.body.requestor, 'seeBadges');
    });

    test('Returns 200 if not in cache, and all the async code succeeds.', async () => {
      const { mockCache: hasCacheMock } = makeMockCache('hasCache', false);
      const { getAllBadges } = makeSut();
      const mockPermission = mockHasPermission(true);
      const badges = [{ badge: 'random badge' }];

      const findMock = jest.spyOn(Badge, 'find').mockImplementationOnce(() => findObject);
      const populateMock = jest
        .spyOn(findObject, 'populate')
        .mockImplementationOnce(() => populateObject);
      const sortMock = jest
        .spyOn(populateObject, 'sort')
        .mockImplementationOnce(() => Promise.resolve(badges));

      getAllBadges(mockReq, mockRes);
      await flushPromises();

      expect(hasCacheMock).toHaveBeenCalledWith('allBadges');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(badges);
      expect(mockPermission).toHaveBeenCalledWith(mockReq.body.requestor, 'seeBadges');
      expect(findMock).toHaveBeenCalledWith(
        {},
        'badgeName type multiple weeks months totalHrs people imageUrl category project ranking description showReport',
      );
      expect(populateMock).toHaveBeenCalledWith({
        path: 'project',
        select: '_id projectName',
      });
      expect(sortMock).toHaveBeenCalledWith({
        ranking: 1,
        badgeName: 1,
      });
    });
  });

  describe('assignBadges method', () => {
    test('Returns 403 if the user is not authorized', async () => {
      const { assignBadges } = makeSut();

      const hasPermissionSpy = mockHasPermission(false);

      const response = await assignBadges(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'assignBadges');
      assertResMock(403, 'You are not authorized to assign badges.', response, mockRes);
    });

    test('Returns 500 if an error occurs in `findById`', async () => {
      const { assignBadges } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const errMsg = 'Error occured when finding';
      const findByIdSpy = jest
        .spyOn(UserProfile, 'findById')
        .mockRejectedValueOnce(new Error(errMsg));

      const response = await assignBadges(mockReq, mockRes);

      assertResMock(500, `Internal Error: Badge Collection. ${errMsg}`, response, mockRes);
      expect(findByIdSpy).toHaveBeenCalledWith(mongoose.Types.ObjectId(mockReq.params.userId));
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'assignBadges');
    });

    test('Returns 400 if user is not found', async () => {
      const { assignBadges } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const findByIdSpy = jest.spyOn(UserProfile, 'findById').mockResolvedValue(null);

      const response = await assignBadges(mockReq, mockRes);

      assertResMock(400, 'Can not find the user to be assigned.', response, mockRes);
      expect(findByIdSpy).toHaveBeenCalledWith(mongoose.Types.ObjectId(mockReq.params.userId));
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'assignBadges');
    });

    test('Returns 500 if an error occurs when saving edited user profile', async () => {
      const { mockCache: hasCacheMock } = makeMockCache('hasCache', false);

      const { assignBadges } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      const errMsg = 'Error when saving';
      const findObj = { save: () => {} };
      const findByIdSpy = jest.spyOn(UserProfile, 'findById').mockResolvedValue(findObj);
      jest.spyOn(findObj, 'save').mockRejectedValueOnce(new Error(errMsg));

      const response = await assignBadges(mockReq, mockRes);

      assertResMock(500, `Internal Error: Badge Collection. ${errMsg}`, response, mockRes);
      expect(findByIdSpy).toHaveBeenCalledWith(mongoose.Types.ObjectId(mockReq.params.userId));
      expect(hasCacheMock).toHaveBeenCalledWith(
        `user-${mongoose.Types.ObjectId(mockReq.params.userId)}`,
      );

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'assignBadges');
    });

    test('Returns 201 and removes appropriate user from cache if successful and user exists in cache', async () => {
      const { mockCache: hasCacheMock, cacheObject } = makeMockCache('hasCache', true);
      const removeCacheMock = jest.spyOn(cacheObject, 'removeCache').mockReturnValueOnce(null);

      const { assignBadges } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      const findObj = { save: () => {} };
      const findByIdSpy = jest.spyOn(UserProfile, 'findById').mockResolvedValue(findObj);
      jest.spyOn(findObj, 'save').mockResolvedValueOnce({ _id: 'randomId' });

      const response = await assignBadges(mockReq, mockRes);

      assertResMock(201, `randomId`, response, mockRes);
      expect(findByIdSpy).toHaveBeenCalledWith(mongoose.Types.ObjectId(mockReq.params.userId));
      expect(hasCacheMock).toHaveBeenCalledWith(
        `user-${mongoose.Types.ObjectId(mockReq.params.userId)}`,
      );
      expect(removeCacheMock).toHaveBeenCalledWith(
        `user-${mongoose.Types.ObjectId(mockReq.params.userId)}`,
      );

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'assignBadges');
    });

    test('Returns 201 and if successful and user does not exist in cache', async () => {
      const { mockCache: hasCacheMock } = makeMockCache('hasCache', false);

      const { assignBadges } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      const findObj = { save: () => {} };
      const findByIdSpy = jest.spyOn(UserProfile, 'findById').mockResolvedValue(findObj);
      jest.spyOn(findObj, 'save').mockResolvedValueOnce({ _id: 'randomId' });

      const response = await assignBadges(mockReq, mockRes);

      assertResMock(201, `randomId`, response, mockRes);
      expect(findByIdSpy).toHaveBeenCalledWith(mongoose.Types.ObjectId(mockReq.params.userId));
      expect(hasCacheMock).toHaveBeenCalledWith(
        `user-${mongoose.Types.ObjectId(mockReq.params.userId)}`,
      );
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'assignBadges');
    });
  });

  describe.only('deleteBadge method', () => {
    test('Returns 403 if the user does not have permission to delete badges', async () => {
      const { deleteBadge } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);

      const response = await deleteBadge(mockReq, mockRes);
      await flushPromises();

      assertResMock(403, { error: 'You are not authorized to delete badges.' }, response, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteBadges');
    });

    test('Returns 400 if an no badge is found', async () => {
      const { deleteBadge } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

      const findByIdSpy = jest
        .spyOn(Badge, 'findById')
        .mockImplementationOnce((_, callback) => callback(null, null));

      const response = await deleteBadge(mockReq, mockRes);

      assertResMock(400, { error: 'No valid records found' }, response, mockRes);
      expect(findByIdSpy).toHaveBeenCalledWith(mockReq.params.badgeId, expect.anything());
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteBadges');
    });

    test('Returns 500 if the removeBadgeFromProfile fails.', async () => {
      const { deleteBadge } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

      const findByIdSpy = jest
        .spyOn(Badge, 'findById')
        .mockImplementationOnce((_, callback) =>
          callback(null, { _id: mockReq.params.badgeId, remove: () => Promise.resolve() }),
        );

      const errMsg = 'Update many failed';
      const updateManyObj = { exec: () => {} };
      const updateManySpy = jest
        .spyOn(UserProfile, 'updateMany')
        .mockImplementationOnce(() => updateManyObj);

      jest.spyOn(updateManyObj, 'exec').mockRejectedValueOnce(new Error(errMsg));

      const response = await deleteBadge(mockReq, mockRes);
      await flushPromises();

      assertResMock(500, new Error(errMsg), response, mockRes);
      expect(findByIdSpy).toHaveBeenCalledWith(mockReq.params.badgeId, expect.anything());
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteBadges');
      expect(updateManySpy).toHaveBeenCalledWith(
        {},
        { $pull: { badgeCollection: { badge: mockReq.params.badgeId } } },
      );
    });
  });
});
