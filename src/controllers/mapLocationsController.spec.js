/// mock the cache function before importing so we can manipulate the implementation
jest.mock('../utilities/nodeCache');
const cache = require('../utilities/nodeCache');
const MapLocation = require('../models/mapLocation');
const UserProfile = require('../models/userProfile');
const { mockReq, mockRes, assertResMock } = require('../test');
const mapLocationsController = require('./mapLocationsController');

const makeSut = () => {
  const { getAllLocations, deleteLocation, putUserLocation, updateUserLocation } =
    mapLocationsController(MapLocation);

  return { getAllLocations, deleteLocation, putUserLocation, updateUserLocation };
};

const flushPromises = () => new Promise(setImmediate);

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

describe('Map Locations Controller', () => {
  beforeEach(() => {
    mockReq.params.locationId = 'randomId';
    mockReq.body.firstName = 'Bob';
    mockReq.body.lastName = 'Bobberson';
    mockReq.body.jobTitle = 'Software Engineer';
    mockReq.body.location = {
      userProvided: 'New York',
      coords: {
        lat: 12,
        lng: 12,
      },
      country: 'USA',
      city: 'New York City',
    };
  });

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
        '_id firstName lastName isActive location jobTitle totalTangibleHrs hoursByCategory homeCountry',
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
        '_id firstName lastName isActive location jobTitle totalTangibleHrs hoursByCategory homeCountry',
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
        '_id firstName lastName isActive location jobTitle totalTangibleHrs hoursByCategory homeCountry',
      );
      expect(findLocationSpy).toHaveBeenCalledWith({});
    });
  });

  describe('deleteLocation method', () => {
    test('Returns 403 if user is not authorized.', async () => {
      mockReq.body.requestor.role = 'Volunteer';
      const { deleteLocation } = makeSut();
      const res = await deleteLocation(mockReq, mockRes);
      assertResMock(403, 'You are not authorized to make changes in the teams.', res, mockRes);
    });

    test('Returns 500 if an error occurs when deleting the map location.', async () => {
      mockReq.body.requestor.role = 'Owner';

      const { deleteLocation } = makeSut();

      const err = new Error('Failed to delete!');
      const deleteSpy = jest.spyOn(MapLocation, 'findOneAndDelete').mockRejectedValueOnce(err);

      const res = await deleteLocation(mockReq, mockRes);
      await flushPromises();

      assertResMock(500, { message: err }, res, mockRes);
      expect(deleteSpy).toHaveBeenCalledWith({ _id: mockReq.params.locationId });
    });

    test('Returns 200 if all is successful', async () => {
      mockReq.body.requestor.role = 'Owner';
      const { deleteLocation } = makeSut();

      const deleteSpy = jest.spyOn(MapLocation, 'findOneAndDelete').mockResolvedValueOnce(true);

      const res = await deleteLocation(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, { message: 'The location was successfully removed!' }, res, mockRes);
      expect(deleteSpy).toHaveBeenCalledWith({ _id: mockReq.params.locationId });
    });
  });

  describe('putUserLocation method', () => {
    test('Returns 403 if user is not authorized.', async () => {
      mockReq.body.requestor.role = 'Volunteer';
      const { putUserLocation } = makeSut();

      const res = await putUserLocation(mockReq, mockRes);
      assertResMock(403, 'You are not authorized to make changes in the teams.', res, mockRes);
    });

    test('Returns 500 if an error occurs when saving the map location.', async () => {
      const { putUserLocation } = makeSut();

      mockReq.body.requestor.role = 'Owner';

      const err = new Error('Saving failed!');

      jest.spyOn(MapLocation.prototype, 'save').mockImplementationOnce(() => Promise.reject(err));

      const res = await putUserLocation(mockReq, mockRes);

      assertResMock(500, { message: err.message }, res, mockRes);
    });

    test('Returns 200 if all is successful.', async () => {
      const { putUserLocation } = makeSut();

      mockReq.body.requestor.role = 'Owner';

      const savedLocationData = {
        _id: 1,
        firstName: mockReq.body.firstName,
        lastName: mockReq.body.lastName,
        jobTitle: mockReq.body.jobTitle,
        location: mockReq.body.location,
      };

      jest
        .spyOn(MapLocation.prototype, 'save')
        .mockImplementationOnce(() => Promise.resolve(savedLocationData));

      const res = await putUserLocation(mockReq, mockRes);

      assertResMock(200, savedLocationData, res, mockRes);
    });
  });

  describe('updateUserLocation method', () => {
    test('Returns 403 if user is not authorized.', async () => {
      const { updateUserLocation } = makeSut();

      mockReq.body.requestor.role = 'Volunteer';

      const res = await updateUserLocation(mockReq, mockRes);

      assertResMock(403, 'You are not authorized to make changes in the teams.', res, mockRes);
    });

    // Returns 500 if an error occurs when updating the user location.
    test('Returns 500 if an error occurs when updating the user location', async () => {
      const { updateUserLocation } = makeSut();
      mockReq.body.requestor.role = 'Owner';
      mockReq.body.type = 'user';
      mockReq.body._id = '60d5f60c2f9b9c3b8a1e4a2f';
      const updateData = {
        firstName: mockReq.body.firstName,
        lastName: mockReq.body.lastName,
        jobTitle: mockReq.body.jobTitle,
        location: mockReq.body.location,
      };

      const errMsg = 'Failed to update user profile!';
      const findAndUpdateSpy = jest
        .spyOn(UserProfile, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.reject(new Error(errMsg)));

      const res = await updateUserLocation(mockReq, mockRes);

      assertResMock(500, { message: new Error(errMsg).message }, res, mockRes);
      expect(findAndUpdateSpy).toHaveBeenCalledWith(
        { _id: mockReq.body._id },
        { $set: { ...updateData, jobTitle: [updateData.jobTitle] } },
        { new: true },
      );
    });

    test('returns 500 if an error occurs when updating map location', async () => {
      const { updateUserLocation } = makeSut();
      mockReq.body.requestor.role = 'Owner';
      mockReq.body.type = 'non-user';
      mockReq.body._id = '60d5f60c2f9b9c3b8a1e4a2f';
      const updateData = {
        firstName: mockReq.body.firstName,
        lastName: mockReq.body.lastName,
        jobTitle: mockReq.body.jobTitle,
        location: mockReq.body.location,
      };

      const errMsg = 'failed to update map locations!';
      const findAndUpdateSpy = jest
        .spyOn(MapLocation, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.reject(new Error(errMsg)));

      const res = await updateUserLocation(mockReq, mockRes);
      assertResMock(500, { message: new Error(errMsg).message }, res, mockRes);
      expect(findAndUpdateSpy).toHaveBeenCalledWith(
        { _id: mockReq.body._id },
        { $set: updateData },
        { new: true },
      );
    });

    test('Returns 200 if all is successful when userType is user and clears and resets cache.', async () => {
      mockReq.body.requestor.role = 'Owner';
      mockReq.body.type = 'user';
      mockReq.body._id = '60d5f60c2f9b9c3b8a1e4a2f';

      const { mockCache: removeAllUsersMock, cacheObject } = makeMockCache('removeCache', true);
      const removeUserCacheSpy = jest
        .spyOn(cacheObject, 'removeCache')
        .mockImplementationOnce(() => true);

      const setCacheSpy = jest.spyOn(cacheObject, 'setCache').mockImplementationOnce(() => true);

      const { updateUserLocation } = makeSut();

      const updateData = {
        firstName: mockReq.body.firstName,
        lastName: mockReq.body.lastName,
        jobTitle: mockReq.body.jobTitle,
        location: mockReq.body.location,
      };

      const queryResponse = {
        firstName: mockReq.body.firstName,
        lastName: mockReq.body.lastName,
        jobTitle: mockReq.body.jobTitle,
        location: mockReq.body.location,
        _id: mockReq.body._id,
      };

      const findOneAndUpdateSpy = jest
        .spyOn(UserProfile, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(queryResponse));

      const res = await updateUserLocation(mockReq, mockRes);

      assertResMock(200, { ...queryResponse, type: mockReq.body.type }, res, mockRes);
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { _id: mockReq.body._id },
        { $set: { ...updateData, jobTitle: [updateData.jobTitle] } },
        { new: true },
      );

      expect(removeAllUsersMock).toHaveBeenCalledWith('allusers');
      expect(removeUserCacheSpy).toHaveBeenCalledWith(`user-${mockReq.body._id}`);
      expect(setCacheSpy).toHaveBeenCalledWith(
        `user-${mockReq.body._id}`,
        JSON.stringify(queryResponse),
      );
    });

    test('Returns 200 if all is succesful when userType is not user', async () => {
      mockReq.body.requestor.role = 'Owner';
      mockReq.body.type = 'not-user';
      mockReq.body._id = '60d5f60c2f9b9c3b8a1e4a2f';

      const { updateUserLocation } = makeSut();

      const updateData = {
        firstName: mockReq.body.firstName,
        lastName: mockReq.body.lastName,
        jobTitle: mockReq.body.jobTitle,
        location: mockReq.body.location,
      };

      const queryResponse = {
        firstName: mockReq.body.firstName,
        lastName: mockReq.body.lastName,
        jobTitle: mockReq.body.jobTitle,
        location: mockReq.body.location,
        _id: mockReq.body._id,
      };

      const findOneAndUpdateSpy = jest
        .spyOn(MapLocation, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(queryResponse));

      const res = await updateUserLocation(mockReq, mockRes);

      assertResMock(200, { ...queryResponse, type: mockReq.body.type }, res, mockRes);
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { _id: mockReq.body._id },
        { $set: updateData },
        { new: true },
      );
    });
  });
});
