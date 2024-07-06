jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(), // Mocking the hasPermission function
}));

const { hasPermission } = require('../utilities/permissions');
const timeZoneAPIController = require('./timeZoneAPIController');
const { mockReq, mockRes, assertResMock } = require('../test');

const flushPromises = () => new Promise(setImmediate);
const makeSut = () => {
  const { getTimeZone, getTimeZoneProfileInitialSetup } = timeZoneAPIController();
  return { getTimeZone, getTimeZoneProfileInitialSetup };
};

describe('timeZoneAPIController Unit Tests', () => {
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
      const response = getTimeZone(mockReq, mockRes);
      await flushPromises();
      assertResMock(401, 'API Key Missing', await response, mockRes);
    });
  });
});
