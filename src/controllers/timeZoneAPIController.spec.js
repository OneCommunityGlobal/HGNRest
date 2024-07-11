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

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    hasPermission.mockResolvedValue(true);
  });

  describe('getTimeZone() function', () => {
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
      assertResMock(401, 'API Key Missing', response, mockRes);
    });

    test('Returns 400, when `location` is missing in req.params', async () => {
      const { getTimeZone } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';
      const response = await getTimeZone(mockReq, mockRes);
      await flushPromises();
      assertResMock(400, 'Missing location', response, mockRes);
    });

    test('Returns 500, when status.code !== 200 and status code is missing', async () => {
      const { getTimeZone } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';
      mockReq.params.location = 'New Jersey';

      fetch.mockImplementation(unsuccessfulFetchRequestInternalServerError);

      const response = await getTimeZone(mockReq, mockRes);
      await flushPromises();

      expect(fetch).toHaveBeenCalled();
      assertResMock(500, 'opencage error- Internal Server Error', response, mockRes);
    });

    test('Returns 404, when status.code == 200 and data.results is empty', async () => {
      const { getTimeZone } = makeSut();
      mockReq.body.requestor.role = 'Volunteer';
      mockReq.params.location = 'New Jersey';

      fetch.mockImplementation(successfulFetchRequestWithNoResults);

      const response = await getTimeZone(mockReq, mockRes);
      await flushPromises();

      expect(fetch).toHaveBeenCalled();
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

      expect(fetch).toHaveBeenCalled();
      assertResMock(200, { timezone, currentLocation }, response, mockRes);
    });
  });
});
