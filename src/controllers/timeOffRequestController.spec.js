jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(), // Mocking the hasPermission function directly
}));

const { hasPermission } = require('../utilities/permissions');
const { mockReq, mockRes, assertResMock } = require('../test');
const timeOffRequestController = require('./timeOffRequestController');
const TimeOffRequest = require('../models/timeOffRequest');
const Team = require('../models/team');
const UserProfile = require('../models/userProfile');

const flushPromises = () => new Promise(setImmediate);

const makeSut = () => {
  const {
    setTimeOffRequest,
    getTimeOffRequests,
    getTimeOffRequestbyId,
    updateTimeOffRequestById,
    deleteTimeOffRequestById,
  } = timeOffRequestController(TimeOffRequest, Team, UserProfile);
  return {
    setTimeOffRequest,
    getTimeOffRequests,
    getTimeOffRequestbyId,
    updateTimeOffRequestById,
    deleteTimeOffRequestById,
  };
};

describe('timeOffRequestController.js module', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTimeOffRequests function', () => {
    test('getTimeOffRequests Returns 200 and correctly formatter all time-off requests', async () => {
      const { getTimeOffRequests } = makeSut();
      const mockData = [
        {
          requestFor: '60c72b2f5f1b2c001c8e4d67',
          requests: [
            {
              reason: 'Vacation',
              startingDate: '2024-06-01T00:00:00Z',
              endingDate: '2024-06-07T00:00:00Z',
              duration: 1,
            },
            {
              reason: 'Family Event',
              startingDate: '2024-06-15T00:00:00Z',
              endingDate: '2024-06-16T00:00:00Z',
              duration: 1,
            },
          ],
        },
        {
          requestFor: '60c72b2f5f1b2c001c8e4d68',
          requests: [
            {
              reason: 'Sick Leave',
              startingDate: '2024-06-02T00:00:00Z',
              endingDate: '2024-06-13T00:00:00Z',
              duration: 2,
            },
          ],
        },
        {
          requestFor: '60c72b2f5f1b2c001c8e4d69',
          requests: [
            {
              reason: 'Conference',
              startingDate: '2024-06-05T00:00:00Z',
              endingDate: '2024-06-28T00:00:00Z',
              duration: 4,
            },
          ],
        },
      ];

      const aggregateSpy = jest.spyOn(TimeOffRequest, 'aggregate').mockResolvedValueOnce(mockData);

      const expectedFormattedMockData = {
        '60c72b2f5f1b2c001c8e4d67': [
          {
            reason: 'Vacation',
            startingDate: '2024-06-01T00:00:00Z',
            endingDate: '2024-06-07T00:00:00Z',
            duration: 1,
          },
          {
            reason: 'Family Event',
            startingDate: '2024-06-15T00:00:00Z',
            endingDate: '2024-06-16T00:00:00Z',
            duration: 1,
          },
        ],
        '60c72b2f5f1b2c001c8e4d68': [
          {
            reason: 'Sick Leave',
            startingDate: '2024-06-02T00:00:00Z',
            endingDate: '2024-06-13T00:00:00Z',
            duration: 2,
          },
        ],
        '60c72b2f5f1b2c001c8e4d69': [
          {
            reason: 'Conference',
            startingDate: '2024-06-05T00:00:00Z',
            endingDate: '2024-06-28T00:00:00Z',
            duration: 4,
          },
        ],
      };

      const response = await getTimeOffRequests(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, expectedFormattedMockData, response, mockRes);
      expect(aggregateSpy).toHaveBeenCalled();
      expect(aggregateSpy).toHaveBeenCalledTimes(1);
    });

    test('getTimeOffRequests Returns 500 if error encountered while aggregating all time-off requests', async () => {
      const { getTimeOffRequests } = makeSut();
      const error = { error: 'Error perforing aggregate operation.' };
      const aggregateSpy = jest.spyOn(TimeOffRequest, 'aggregate').mockRejectedValueOnce(error);

      const response = await getTimeOffRequests(mockReq, mockRes);
      await flushPromises();

      assertResMock(500, error, response, mockRes);
      expect(aggregateSpy).toHaveBeenCalled();
      expect(aggregateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTimeOffRequestbyId function', () => {
    test('Returns 404 if time-off request with a particular id is not found', async () => {
      const { getTimeOffRequestbyId } = makeSut();
      const mockData = null;

      const findOneSpy = jest.spyOn(TimeOffRequest, 'findOne').mockResolvedValueOnce(mockData);

      const response = await getTimeOffRequestbyId(mockReq, mockRes);
      await flushPromises();
      const error = 'Time off request not found';
      assertResMock(404, error, response, mockRes);
      expect(findOneSpy).toHaveBeenCalled();
      expect(findOneSpy).toHaveBeenCalledTimes(1);
    });

    test('Returns 200 if time-off request with a particular id is found', async () => {
      const { getTimeOffRequestbyId } = makeSut();
      const mockData = {
        requestFor: 'sd9028_sdas83ink84haso1',
        reason: 'Family Gathering.',
        startingDate: new Date(2024, 5, 1),
        endingDate: new Date(2024, 5, 13),
        duration: 2,
      };

      const findOneSpy = jest.spyOn(TimeOffRequest, 'findOne').mockResolvedValueOnce(mockData);

      const response = await getTimeOffRequestbyId(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, mockData, response, mockRes);
      expect(findOneSpy).toHaveBeenCalled();
      expect(findOneSpy).toHaveBeenCalledTimes(1);
    });

    test('Returns 500 if error occurred while fetching time-off request with an id', async () => {
      const { getTimeOffRequestbyId } = makeSut();

      const error = new Error('Some error occurred.');
      const findOneSpy = jest.spyOn(TimeOffRequest, 'findOne').mockRejectedValueOnce(error);

      const response = await getTimeOffRequestbyId(mockReq, mockRes);
      await flushPromises();
      assertResMock(500, error, response, mockRes);
      expect(findOneSpy).toHaveBeenCalled();
      expect(findOneSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteTimeOffRequestById function', () => {
    test('Returns 403 if user is not authorized', async () => {
      const { deleteTimeOffRequestById } = makeSut();

      // Creating a deep copy of mockReq
      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.body.requestor.role = 'volunteer';
      mockReqCopy.body.requestor.permissions.frontPermissions = [];
      mockReqCopy.body.requestor.permissions.backPermissions = [];
      mockReqCopy.params.id = '123';

      const error = 'You are not authorized to set time off requests.';

      const mockData = null;
      const findByIdSpy = jest.spyOn(TimeOffRequest, 'findById').mockResolvedValueOnce(mockData);

      hasPermission.mockImplementation(async () => false);

      const response = await deleteTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
      expect(findByIdSpy).toHaveBeenCalled();
      expect(findByIdSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(findByIdSpy).toHaveBeenCalledTimes(1);

      expect(hasPermission).toHaveBeenCalledWith(
        mockReqCopy.body.requestor,
        'manageTimeOffRequests',
      );
      expect(hasPermission).toHaveBeenCalledTimes(1);
    });

    test('Returns 404 if no timeOffRequest exists with the particular Id', async () => {
      const { deleteTimeOffRequestById } = makeSut();

      // Creating a deep copy of mockReq
      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.body.requestor.role = 'volunteer';
      mockReqCopy.body.requestor.permissions.frontPermissions = [];
      mockReqCopy.body.requestor.permissions.backPermissions = [];
      mockReqCopy.params.id = '123';

      const error = 'You are not authorized to set time off requests.';

      const mockData = null;
      const findByIdSpy = jest.spyOn(TimeOffRequest, 'findById').mockResolvedValueOnce(mockData);

      hasPermission.mockImplementation(async () => false);

      const response = await deleteTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
      expect(findByIdSpy).toHaveBeenCalled();
      expect(findByIdSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(findByIdSpy).toHaveBeenCalledTimes(1);

      expect(hasPermission).toHaveBeenCalledWith(
        mockReqCopy.body.requestor,
        'manageTimeOffRequests',
      );
      expect(hasPermission).toHaveBeenCalledTimes(1);
    });

    test('Returns 500 if an error occurs at TimeOffRequest.findById()', async () => {
      const { deleteTimeOffRequestById } = makeSut();

      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.body.requestor.role = 'Administrator';
      mockReqCopy.body.requestor.permissions.frontPermissions = [];
      mockReqCopy.body.requestor.permissions.backPermissions = ['manageTimeOffRequests'];
      mockReqCopy.params.id = '123';

      const errorMessage = 'Internal Server Error';
      const error = new Error(errorMessage);

      const findByIdSpy = jest.spyOn(TimeOffRequest, 'findById').mockImplementationOnce(() => {
        throw error;
      });

      hasPermission.mockImplementation(async () => true);

      const response = await deleteTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(500, error, response, mockRes);

      expect(findByIdSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(findByIdSpy).toHaveBeenCalledTimes(1);
    });

    test('Returns 500 if an error occurs while TimeOffRequest.findByIdAndDelete()', async () => {
      const { deleteTimeOffRequestById } = makeSut();

      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.body.requestor.role = 'Administrator';
      mockReqCopy.body.requestor.permissions.frontPermissions = [];
      mockReqCopy.body.requestor.permissions.backPermissions = ['manageTimeOffRequests'];
      mockReqCopy.params.id = '123';

      const errorMessage = 'Internal Server Error';
      const error = new Error(errorMessage);

      const mockData = {
        requestFor: 'sd9028_sdas83ink84haso1',
        reason: 'Family Gathering.',
        startingDate: new Date(2024, 5, 1),
        endingDate: new Date(2024, 5, 13),
        duration: 2,
      };

      const findByIdSpy = jest
        .spyOn(TimeOffRequest, 'findById')
        .mockImplementationOnce(() => mockData);
      const findByIdAndDeleteSpy = jest
        .spyOn(TimeOffRequest, 'findByIdAndDelete')
        .mockImplementationOnce(() => {
          throw error;
        });

      hasPermission.mockImplementation(async () => error);

      const response = await deleteTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(500, error, response, mockRes);

      expect(findByIdSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(findByIdSpy).toHaveBeenCalledTimes(1);

      expect(hasPermission).toHaveBeenCalledWith(
        mockReqCopy.body.requestor,
        'manageTimeOffRequests',
      );
      expect(hasPermission).toHaveBeenCalledTimes(1);

      expect(findByIdAndDeleteSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(findByIdAndDeleteSpy).toHaveBeenCalledTimes(1);
    });

    test('Returns 200 on successfully deleting the TimeOffRequest', async () => {
      const { deleteTimeOffRequestById } = makeSut();

      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.body.requestor.role = 'Administrator';
      mockReqCopy.body.requestor.permissions.frontPermissions = [];
      mockReqCopy.body.requestor.permissions.backPermissions = ['manageTimeOffRequests'];
      mockReqCopy.params.id = '123';

      const mockData = {
        requestFor: 'sd9028_sdas83ink84haso1',
        reason: 'Family Gathering.',
        startingDate: new Date(2024, 5, 1),
        endingDate: new Date(2024, 5, 13),
        duration: 2,
      };

      const findByIdSpy = jest
        .spyOn(TimeOffRequest, 'findById')
        .mockImplementationOnce(() => mockData);
      const findByIdAndDeleteSpy = jest
        .spyOn(TimeOffRequest, 'findByIdAndDelete')
        .mockImplementationOnce(() => mockData);

      hasPermission.mockImplementation(async () => true);

      const response = await deleteTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(200, mockData, response, mockRes);

      expect(findByIdSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(findByIdSpy).toHaveBeenCalledTimes(1);

      expect(hasPermission).toHaveBeenCalledWith(
        mockReqCopy.body.requestor,
        'manageTimeOffRequests',
      );
      expect(hasPermission).toHaveBeenCalledTimes(1);

      expect(findByIdAndDeleteSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(findByIdAndDeleteSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateTimeOffRequestById function', () => {
    test('Returns 403 if user is not authorized', async () => {
      const { updateTimeOffRequestById } = makeSut();

      // Creating a deep copy of mockReq
      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.body.requestor.role = 'volunteer';
      mockReqCopy.body.requestor.permissions.frontPermissions = [];
      mockReqCopy.body.requestor.permissions.backPermissions = [];
      mockReqCopy.params.id = '123';

      const error = 'You are not authorized to set time off requests.';

      hasPermission.mockImplementation(async () => false);

      const response = await updateTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);

      expect(hasPermission).toHaveBeenCalledWith(
        mockReqCopy.body.requestor,
        'manageTimeOffRequests',
      );
      expect(hasPermission).toHaveBeenCalledTimes(1);
    });
  });
});
