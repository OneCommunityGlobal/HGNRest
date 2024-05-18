const MapLocation = require('../models/mapLocation');
const UserProfile = require('../models/userProfile');
const { mockReq, mockRes, assertResMock } = require('../test');
const mapLocationsController = require('./mapLocationsController');

// mock the cache function before importing so we can manipulate the implementation
// jest.mock('../utilities/nodeCache');
// const cache = require('../utilities/nodeCache');

const makeSut = () => {
  const { getAllLocations } = mapLocationsController(MapLocation);

  return { getAllLocations };
};

// const makeMockCache = (method, value) => {
//   const cacheObject = {
//     getCache: jest.fn(),
//     removeCache: jest.fn(),
//     hasCache: jest.fn(),
//     setCache: jest.fn(),
//   };

//   const mockCache = jest.spyOn(cacheObject, method).mockImplementationOnce(() => value);

//   cache.mockImplementationOnce(() => cacheObject);

//   return { mockCache, cacheObject };
// };

describe('Map Locations Controller', () => {
  beforeEach(() => {});

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllLocations method', () => {
    test('Returns 404 if an error occurs when finding all users.', async () => {
      const { getAllLocations } = makeSut();

      const errMsg = 'Failed to find users!';
      const findSpy = jest.spyOn(UserProfile, 'find').mockRejectedValueOnce(new Error(errMsg));

      const res = await getAllLocations(mockReq, mockRes);

      assertResMock(404, new Error(errMsg), res, mockRes);
      expect(findSpy).toHaveBeenCalledWith(
        {},
        '_id firstName lastName isActive location jobTitle totalTangibleHrs hoursByCategory',
      );
    });

    test('Returns 404 if an error occurs when finding all map locations.', async () => {
      const { getAllLocations } = makeSut();

      const errMsg = 'Failed to find locations!';
      const findSpy = jest.spyOn(UserProfile, 'find').mockResolvedValueOnce([]);
      const findLocationSpy = jest
        .spyOn(MapLocation, 'find')
        .mockRejectedValueOnce(new Error(errMsg));

      const res = await getAllLocations(mockReq, mockRes);

      assertResMock(404, new Error(errMsg), res, mockRes);
      expect(findSpy).toHaveBeenCalledWith(
        {},
        '_id firstName lastName isActive location jobTitle totalTangibleHrs hoursByCategory',
      );
      expect(findLocationSpy).toHaveBeenCalledWith({});
    });

    test('Returns 200 if all is successful', async () => {
      const { getAllLocations } = makeSut();

      const findRes = [
        {
          _id: 1,
          firstName: 'bob',
          lastName: 'marley',
          isActive: true,
          location: {
            coords: {
              lat: 12,
              lng: 12,
            },
            country: 'USA',
            city: 'NYC',
          },
          jobTitle: ['software engineer'],
          totalTangibleHrs: 11,
        },
      ];
      const findSpy = jest.spyOn(UserProfile, 'find').mockResolvedValueOnce(findRes);
      const findLocationSpy = jest.spyOn(MapLocation, 'find').mockResolvedValueOnce([]);

      const modifiedUsers = {
        location: findRes[0].location,
        isActive: findRes[0].isActive,
        jobTitle: findRes[0].jobTitle[0],
        _id: findRes[0]._id,
        firstName: findRes[0].firstName,
        lastName: findRes[0].lastName,
      };
      const res = await getAllLocations(mockReq, mockRes);

      assertResMock(200, { users: [modifiedUsers], mUsers: [] }, res, mockRes);
      expect(findSpy).toHaveBeenCalledWith(
        {},
        '_id firstName lastName isActive location jobTitle totalTangibleHrs hoursByCategory',
      );
      expect(findLocationSpy).toHaveBeenCalledWith({});
    });
  });
});
