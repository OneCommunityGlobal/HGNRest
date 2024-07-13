jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(), // Mocking the hasPermission function
}));

jest.mock('node-fetch');
// eslint-disable-next-line import/no-extraneous-dependencies
const fetch = require('node-fetch');

const originalPremiumKey = process.env.TIMEZONE_PREMIUM_KEY;
process.env.TIMEZONE_PREMIUM_KEY = 'mockPremiumKey';

const successfulFetchRequestWithResults = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        status: {
          code: 200,
          message: 'Request Processed Successfully',
        },
        results: [
          {
            annotations: {
              timezone: {
                name: 'timeZone - Fiji',
              },
            },
            geometry: {
              lat: 1,
              lng: 1,
            },
            components: {
              country: 'U.S.',
              city: 'Paris',
            },
          },
        ],
      }),
  }),
);

const successfulFetchRequestWithNoResults = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        status: {
          code: 200,
          message: 'Request Processed Successfully',
        },
        results: [],
      }),
  }),
);

const unsuccessfulFetchRequestInternalServerError = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        status: {
          code: null,
          message: 'Internal Server Error',
        },
        results: [],
      }),
  }),
);

const { hasPermission } = require('../utilities/permissions');
const timeZoneAPIController = require('./timeZoneAPIController');
const ProfileInitialSetupToken = require('../models/profileInitialSetupToken');
const { mockReq, mockRes, assertResMock } = require('../test');

const flushPromises = () => new Promise(setImmediate);
const makeSut = () => {
  const { getTimeZone, getTimeZoneProfileInitialSetup } = timeZoneAPIController();
  return { getTimeZone, getTimeZoneProfileInitialSetup };
};

describe('timeZoneAPIController Unit Tests', () => {
  afterAll(() => {
    // Reseting TIMEZONE_PREMIUM_KEY and TIMEZONE_COMMON_KEY environment variables to their original values
    if (originalPremiumKey) {
      process.env.TIMEZONE_PREMIUM_KEY = originalPremiumKey;
    } else {
      delete process.env.TIMEZONE_PREMIUM_KEY;
    }
  });

  describe('getTimeZone() function', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    beforeEach(() => {
      hasPermission.mockResolvedValue(true);
    });
    test('Returns 403, as requestor.role is missing in request body', async () => {
      const { getTimeZone } = makeSut();

      // setting request.role to `Null`
      mockReq.body.requestor.role = null;

      const response = await getTimeZone(mockReq, mockRes);

      assertResMock(403, 'Unauthorized Request', response, mockRes);
    });

    test('Returns 401, as API is missing', async () => {
      const { getTimeZone } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';

      hasPermission.mockResolvedValue(false);

      const response = await getTimeZone(mockReq, mockRes);
      await flushPromises();

      expect(hasPermission).toBeCalledTimes(1);
      assertResMock(401, 'API Key Missing', response, mockRes);
    });

    test('Returns 400, when `location` is missing in req.params', async () => {
      const { getTimeZone } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';

      const response = await getTimeZone(mockReq, mockRes);
      await flushPromises();

      expect(hasPermission).toBeCalledTimes(1);
      assertResMock(400, 'Missing location', response, mockRes);
    });

    test('Returns 500, when status.code !== 200 and status code is missing', async () => {
      const { getTimeZone } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';
      mockReq.params.location = 'New Jersey';

      fetch.mockImplementation(unsuccessfulFetchRequestInternalServerError);

      const response = await getTimeZone(mockReq, mockRes);
      await flushPromises();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(hasPermission).toBeCalledTimes(1);
      assertResMock(500, 'opencage error- Internal Server Error', response, mockRes);
    });

    test('Returns 404, when status.code == 200 and data.results is empty', async () => {
      const { getTimeZone } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';
      mockReq.params.location = 'New Jersey';

      fetch.mockImplementation(successfulFetchRequestWithNoResults);

      const response = await getTimeZone(mockReq, mockRes);
      await flushPromises();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(hasPermission).toBeCalledTimes(1);
      assertResMock(404, 'No results found', response, mockRes);
    });

    test('Returns 200, when status.code == 200 and data.results is not empty', async () => {
      const { getTimeZone } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';
      mockReq.params.location = 'New Jersey';

      fetch.mockImplementation(successfulFetchRequestWithResults);
      const timezone = 'timeZone - Fiji'; // mocking the timezone data to be returned by `successfulFetchRequestWithResults`
      const currentLocation = {
        // mocking the currentLocation data to be returned by `successfulFetchRequestWithResults`
        userProvided: mockReq.params.location,
        coords: {
          lat: 1,
          lng: 1,
        },
        country: 'U.S.',
        city: 'Paris',
      };

      const response = await getTimeZone(mockReq, mockRes);
      await flushPromises();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(hasPermission).toBeCalledTimes(1);
      assertResMock(200, { timezone, currentLocation }, response, mockRes);
    });
  });

  describe('getTimeZoneProfileInitialSetup() function', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    beforeEach(() => {
      hasPermission.mockResolvedValue(true);
    });

    test('Returns status code 400 if token is missing in request.body', async () => {
      mockReq.body.token = null;

      const { getTimeZoneProfileInitialSetup } = makeSut();

      const response = await getTimeZoneProfileInitialSetup(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, 'Missing token', response, mockRes);
    });

    test('Returns status code 403 if token is missing in request.body', async () => {
      mockReq.body.token = 'random_token_value';

      const { getTimeZoneProfileInitialSetup } = makeSut();
      const profileInitialSetupTokenFindOneSpy = jest
        .spyOn(ProfileInitialSetupToken, 'findOne')
        .mockReturnValue(null);

      const response = await getTimeZoneProfileInitialSetup(mockReq, mockRes);
      await flushPromises();

      expect(profileInitialSetupTokenFindOneSpy).toBeCalledTimes(1);
      assertResMock(403, 'Unauthorized Request', response, mockRes);
    });

    test('Returns 500, when status.code !== 200 and status code is missing', async () => {
      const { getTimeZoneProfileInitialSetup } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';
      mockReq.params.location = 'New Jersey';

      const profileInitialSetupTokenFindOneSpy = jest
        .spyOn(ProfileInitialSetupToken, 'findOne')
        .mockReturnValue('token');
      fetch.mockImplementation(unsuccessfulFetchRequestInternalServerError);

      const response = await getTimeZoneProfileInitialSetup(mockReq, mockRes);
      await flushPromises();

      expect(profileInitialSetupTokenFindOneSpy).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(1);
      assertResMock(500, 'opencage error- Internal Server Error', response, mockRes);
    });

    test('Returns 404, when status.code == 200 and data.results is empty', async () => {
      const { getTimeZoneProfileInitialSetup } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';
      mockReq.params.location = 'New Jersey';

      const profileInitialSetupTokenFindOneSpy = jest
        .spyOn(ProfileInitialSetupToken, 'findOne')
        .mockReturnValue('token');
      fetch.mockImplementation(successfulFetchRequestWithNoResults);

      const response = await getTimeZoneProfileInitialSetup(mockReq, mockRes);
      await flushPromises();

      expect(profileInitialSetupTokenFindOneSpy).toBeCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(1);
      assertResMock(404, 'No results found', response, mockRes);
    });

    test('Returns 200, when status.code == 200 and data.results is not empty', async () => {
      const { getTimeZoneProfileInitialSetup } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';
      mockReq.params.location = 'New Jersey';

      const profileInitialSetupTokenFindOneSpy = jest
        .spyOn(ProfileInitialSetupToken, 'findOne')
        .mockReturnValue('token');
      fetch.mockImplementation(successfulFetchRequestWithResults);

      const timezone = 'timeZone - Fiji'; // mocking the timezone data to be returned by `successfulFetchRequestWithResults`
      const currentLocation = {
        // mocking the currentLocation data to be returned by `successfulFetchRequestWithResults`
        userProvided: mockReq.params.location,
        coords: {
          lat: 1,
          lng: 1,
        },
        country: 'U.S.',
        city: 'Paris',
      };

      const response = await getTimeZoneProfileInitialSetup(mockReq, mockRes);
      await flushPromises();

      expect(profileInitialSetupTokenFindOneSpy).toBeCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(1);
      assertResMock(200, { timezone, currentLocation }, response, mockRes);
    });

    test('Returns 400, when `location` is missing in req.params', async () => {
      const { getTimeZoneProfileInitialSetup } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';
      mockReq.params.location = null;

      const profileInitialSetupTokenFindOneSpy = jest
        .spyOn(ProfileInitialSetupToken, 'findOne')
        .mockReturnValue('token');

      const response = await getTimeZoneProfileInitialSetup(mockReq, mockRes);
      await flushPromises();

      expect(profileInitialSetupTokenFindOneSpy).toBeCalledTimes(1);
      assertResMock(400, 'Missing location', response, mockRes);
    });
  });
});
