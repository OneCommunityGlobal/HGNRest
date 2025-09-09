jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(), // Mocking the hasPermission function directly
}));
jest.mock('../utilities/emailSender', () => jest.fn());

const mongoose = require('mongoose');
const moment = require('moment-timezone');
const emailSender = require('../utilities/emailSender');
const { hasPermission } = require('../utilities/permissions');
const { mockReq, mockRes, assertResMock } = require('../test');
const timeOffRequestController = require('./timeOffRequestController');
const TimeOffRequest = require('../models/timeOffRequest');
const Team = require('../models/team');
const UserProfile = require('../models/userProfile');

const flushPromises = () => new Promise(setImmediate);

const { ObjectId } = mongoose.Types;

const makeSut = () => {
  const controller = timeOffRequestController(TimeOffRequest, Team, UserProfile);
  return {
    setTimeOffRequest: controller.setTimeOffRequest,
    getTimeOffRequests: controller.getTimeOffRequests,
    getTimeOffRequestbyId: controller.getTimeOffRequestbyId,
    updateTimeOffRequestById: controller.updateTimeOffRequestById,
    deleteTimeOffRequestById: controller.deleteTimeOffRequestById,
  };
};

const controller = timeOffRequestController(TimeOffRequest, Team, UserProfile);

const getAdminEmailIds = (userProfiles) => {
  const rolesToInclude = ['Manager', 'Mentor', 'Administrator']; // describes Admin roles

  return userProfiles
    .map((userProfile) => {
      if (rolesToInclude.includes(userProfile.role)) {
        return userProfile.email;
      }
      return null;
    })
    .filter((email) => email !== null);
};

const mockTimeOffRequest = () => ({
  _id: 'mockTimeOffRequestId',
  requestFor: 'mockUserId',
  reason: 'Mock Reason',
  startingDate: new Date(),
  endingDate: new Date(),
  duration: 1,
});

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

      const timeOffRequestAggregateSpy = jest
        .spyOn(TimeOffRequest, 'aggregate')
        .mockResolvedValueOnce(mockData);

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
      expect(timeOffRequestAggregateSpy).toHaveBeenCalled();
      expect(timeOffRequestAggregateSpy).toHaveBeenCalledTimes(1);
    });

    test('getTimeOffRequests Returns 500 if error encountered while aggregating all time-off requests', async () => {
      const { getTimeOffRequests } = makeSut();
      const error = { error: 'Error perforing aggregate operation.' };
      const timeOffRequestAggregateSpy = jest
        .spyOn(TimeOffRequest, 'aggregate')
        .mockRejectedValueOnce(error);

      const response = await getTimeOffRequests(mockReq, mockRes);
      await flushPromises();

      assertResMock(500, error, response, mockRes);
      expect(timeOffRequestAggregateSpy).toHaveBeenCalled();
      expect(timeOffRequestAggregateSpy).toHaveBeenCalledTimes(1);
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
      const timeOffRequestFindByIdSpy = jest
        .spyOn(TimeOffRequest, 'findById')
        .mockResolvedValueOnce(mockData);

      hasPermission.mockImplementation(async () => false);

      const response = await deleteTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
      expect(timeOffRequestFindByIdSpy).toHaveBeenCalled();
      expect(timeOffRequestFindByIdSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(timeOffRequestFindByIdSpy).toHaveBeenCalledTimes(1);

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
      const timeOffRequestFindByIdSpy = jest
        .spyOn(TimeOffRequest, 'findById')
        .mockResolvedValueOnce(mockData);

      hasPermission.mockImplementation(async () => false);

      const response = await deleteTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
      expect(timeOffRequestFindByIdSpy).toHaveBeenCalled();
      expect(timeOffRequestFindByIdSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(timeOffRequestFindByIdSpy).toHaveBeenCalledTimes(1);

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

      const timeOffRequestFindByIdSpy = jest
        .spyOn(TimeOffRequest, 'findById')
        .mockImplementationOnce(() => {
          throw error;
        });

      hasPermission.mockImplementation(async () => true);

      const response = await deleteTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(500, error, response, mockRes);

      expect(timeOffRequestFindByIdSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(timeOffRequestFindByIdSpy).toHaveBeenCalledTimes(1);
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

      const timeOffRequestFindByIdSpy = jest
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

      expect(timeOffRequestFindByIdSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(timeOffRequestFindByIdSpy).toHaveBeenCalledTimes(1);

      expect(hasPermission).toHaveBeenCalledWith(
        mockReqCopy.body.requestor,
        'manageTimeOffRequests',
      );
      expect(hasPermission).toHaveBeenCalledTimes(1);

      expect(findByIdAndDeleteSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(findByIdAndDeleteSpy).toHaveBeenCalledTimes(1);
    });

    test('Returns 200 on successfully deleting the TimeOffRequest; should not call emailSender as `deleteOwnRequest` is false', async () => {
      const { deleteTimeOffRequestById } = makeSut();

      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.body.requestor.role = 'Administrator';
      mockReqCopy.body.requestor.permissions.backPermissions = ['manageTimeOffRequests'];
      mockReqCopy.params.id = '123';

      const mockData = {
        requestFor: 'testUser123',
        reason: 'Vacation',
        startingDate: new Date(2024, 5, 1),
        endingDate: new Date(2024, 5, 7),
        duration: 1,
      };

      jest.spyOn(TimeOffRequest, 'findById').mockResolvedValue(mockData);
      jest.spyOn(TimeOffRequest, 'findByIdAndDelete').mockResolvedValue(mockData);
      hasPermission.mockResolvedValue(true);

      const response = await deleteTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(200, mockData, response, mockRes);

      expect(emailSender).not.toHaveBeenCalled(); // Ensure emailSender is not called
    });

    test.skip('Returns 200 on successfully deleting the TimeOffRequest; notifyUser calls emailSender once and notifyAdmins does not call emailSender', async () => {
      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.body.requestor.role = 'Administrator';
      mockReqCopy.body.requestor.permissions.backPermissions = ['manageTimeOffRequests'];
      mockReqCopy.params.id = '123';

      const mockData = {
        requestFor: 'testUser123',
        reason: 'Vacation',
        startingDate: new Date(2024, 5, 1),
        endingDate: new Date(2024, 5, 7),
        duration: 1,
      };

      jest.spyOn(TimeOffRequest, 'findById').mockResolvedValue(mockData);
      jest.spyOn(TimeOffRequest, 'findByIdAndDelete').mockResolvedValue(mockData);
      hasPermission.mockResolvedValue(true);

      const response = await controller.deleteTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(200, mockData, response, mockRes);

      expect(emailSender).toHaveBeenCalledTimes(1); // Ensure emailSender is called once
    });

    test('Returns 200 on successfully deleting the TimeOffRequest; notifyUser calls emailSender once and notifyAdmins calls emailSender 5 times', async () => {
      const { deleteTimeOffRequestById } = makeSut();

      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.body.requestor.role = 'Administrator';
      mockReqCopy.body.requestor.permissions.frontPermissions = [];
      mockReqCopy.body.requestor.permissions.backPermissions = ['manageTimeOffRequests'];
      mockReqCopy.body.requestor.requestorId = 'sd9028_sdas83ink84haso1';
      mockReqCopy.params.id = '123';

      const mockData = {
        requestFor: 'sd9028_sdas83ink84haso1',
        reason: 'Family Gathering.',
        startingDate: new Date(2024, 5, 1),
        endingDate: new Date(2024, 5, 13),
        duration: 2,
      };

      const mockedUserData = {
        firstName: 'testUserFirstName',
        lastName: 'testUserLastName',
        email: 'testUser@testing.com',
      };

      const mockedOwnerAccountEmails = [
        // No owner accounts hence NotifyAdmins sends 2 emails
        { email: 'temp1@gmail.com' },
        { email: 'temp2@gmail.com' },
      ];

      const mockedUserTeams = [
        {
          // object represents a team 1
          members: [
            // array represents team members
            { userId: new ObjectId('60c72b2f9b1d8b3a8c8f8b3a') },
            { userId: new ObjectId('60c72b2f9b1d8b3a8c8f8b3d') },
            { userId: new ObjectId('60c72b2f9b1d8b3a8c8f8b3e') },
          ],
        },
        {
          // object represents a team 2
          members: [
            // array represents team members
            { userId: new ObjectId('60c72b2f9b1d8b3a8c8f8b3a') },
            { userId: new ObjectId('60c72b2f9b1d8b3a8c8f8b3d') },
            { userId: new ObjectId('60c72b2f9b1d8b3a8c8f8b3e') },
          ],
        },
      ];

      const mockedUserProfiles = [
        { role: 'Manager', email: 'abc_123' },
        { role: 'Tester', email: 'def_456' },
        { role: 'Developer', email: 'ghi_789' },
        { role: 'Administrator', email: 'jkl_000' },
        { role: 'Volunteer', email: 'sd9028_sdas83ink84haso1' },
      ];

      const userProfileFindByIdSpy = jest
        .spyOn(UserProfile, 'findById')
        .mockResolvedValue(mockedUserData);

      const chaining = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockedOwnerAccountEmails),
      };

      const userEmails = getAdminEmailIds(mockedUserProfiles);

      const userProfileFindSpy = jest.spyOn(UserProfile, 'find').mockImplementation((query) => {
        if ('role' in query && query.role === 'Owner') {
          return chaining;
        }
        if ('_id' in query && '$in' in query._id) {
          // Mocking the query for _id
          return Promise.resolve(mockedUserProfiles);
        }
      });

      const teamFindSpy = jest.spyOn(Team, 'find').mockResolvedValue(mockedUserTeams);

      const timeOffRequestFindByIdSpy = jest
        .spyOn(TimeOffRequest, 'findById')
        .mockResolvedValue(mockData);

      const timeOffRequestFindByIdAndDeleteSpy = jest
        .spyOn(TimeOffRequest, 'findByIdAndDelete')
        .mockResolvedValue(mockData);

      hasPermission.mockImplementation(async () => true);

      const response = await deleteTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(200, mockData, response, mockRes);

      expect(timeOffRequestFindByIdSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(timeOffRequestFindByIdSpy).toHaveBeenCalledTimes(1);

      expect(hasPermission).toHaveBeenCalledWith(
        mockReqCopy.body.requestor,
        'manageTimeOffRequests',
      );
      expect(hasPermission).toHaveBeenCalledTimes(1);

      expect(timeOffRequestFindByIdAndDeleteSpy).toHaveBeenCalledWith(mockReqCopy.params.id);
      expect(timeOffRequestFindByIdAndDeleteSpy).toHaveBeenCalledTimes(1);

      expect(userProfileFindByIdSpy).toHaveBeenCalledTimes(2);

      expect(userProfileFindSpy).toHaveBeenCalledTimes(2);

      expect(teamFindSpy).toHaveBeenCalledTimes(1);
      expect(teamFindSpy).toHaveBeenCalledWith({ 'members.userId': mockData.requestFor });

      expect(emailSender).toHaveBeenCalledTimes(
        1 + mockedOwnerAccountEmails.length + userEmails.length,
      ); // addition of 1 represents emailSender function call by notifyUser Function
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

    test.each`
      duration    | startingDate             | reason       | requestId    | expectedMessage
      ${'1 week'} | ${new Date('2024-06-8')} | ${'Sick'}    | ${null}      | ${'bad request'}
      ${null}     | ${new Date('2024-06-8')} | ${'Injury'}  | ${'user123'} | ${'bad request'}
      ${'5 week'} | ${null}                  | ${'Wedding'} | ${'user123'} | ${'bad request'}
      ${'7 week'} | ${new Date('2024-06-8')} | ${null}      | ${'user123'} | ${'bad request'}
    `(
      `returns 400 when duration is $duration, startingDate is $startingDate, reason is $reason, and requestId is $requestId`,
      async ({ duration, startingDate, reason, requestId, expectedMessage }) => {
        const { updateTimeOffRequestById } = makeSut();

        const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
        mockReqCopy.body.requestor.role = 'Administrator';
        mockReqCopy.body.requestor.requestorId = 'user123';
        mockReqCopy.params.id = requestId;

        mockReqCopy.body.duration = duration;
        mockReqCopy.body.reason = reason;
        mockReqCopy.body.startingDate = startingDate;
        mockReqCopy.body.requestId = requestId;

        hasPermission.mockImplementation(async () => true);

        const response = await updateTimeOffRequestById(mockReqCopy, mockRes);

        expect(hasPermission).toHaveBeenCalledWith(
          mockReqCopy.body.requestor,
          'manageTimeOffRequests',
        );
        assertResMock(400, expectedMessage, response, mockRes);
      },
    );

    test('Returns 404 if no timeOffRequest is found', async () => {
      const { updateTimeOffRequestById } = makeSut();

      // Creating a deep copy of mockReq
      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.params.id = '123';

      mockReqCopy.body.requestor = {
        ...mockReqCopy.body.requestor, // Preserving existing properties
        role: 'Owner',
        permissions: {
          frontPermissions: [],
          backPermissions: [],
        },
      };

      const timeOffDuration = 5;
      const timeOffStartingDate = new Date(2024, 5, 12);
      const timeOffReason = 'Testing a leave request';

      moment.tz.setDefault('America/Los_Angeles');

      const startDate = moment(timeOffStartingDate);
      const endDate = startDate.clone().add(Number(timeOffDuration), 'weeks').subtract(1, 'day');

      const mockUpdateData = {
        reason: timeOffReason,
        startingDate: startDate.toDate(),
        endingDate: endDate.toDate(),
        duration: timeOffDuration,
      };

      mockReqCopy.body = {
        ...mockReqCopy.body,
        duration: timeOffDuration,
        startingDate: timeOffStartingDate,
        reason: timeOffReason,
      };

      const error = 'Time off request not found';

      hasPermission.mockImplementation(async () => true);
      const timeOffRequestFindByIdAndUpdateSpy = jest
        .spyOn(TimeOffRequest, 'findByIdAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(null));

      const response = await updateTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(404, error, response, mockRes);

      expect(hasPermission).toHaveBeenCalledWith(
        mockReqCopy.body.requestor,
        'manageTimeOffRequests',
      );
      expect(hasPermission).toHaveBeenCalledTimes(1);

      expect(timeOffRequestFindByIdAndUpdateSpy).toHaveBeenCalled();
      expect(timeOffRequestFindByIdAndUpdateSpy).toHaveBeenCalledTimes(1);
      expect(timeOffRequestFindByIdAndUpdateSpy).toHaveBeenCalledWith(
        mockReqCopy.params.id,
        mockUpdateData,
        {
          new: true,
        },
      );
    });

    test('Returns 200 on successful update operation', async () => {
      const { updateTimeOffRequestById } = makeSut();

      // Creating a deep copy of mockReq
      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.params.id = '123';

      mockReqCopy.body.requestor = {
        ...mockReqCopy.body.requestor,
        role: 'Owner',
        permissions: {
          frontPermissions: [],
          backPermissions: [],
        },
      };

      const timeOffDuration = 5;
      const timeOffStartingDate = new Date(2024, 5, 12);
      const timeOffReason = 'Testing a leave request';

      moment.tz.setDefault('America/Los_Angeles');
      const startDate = moment(timeOffStartingDate);
      const endDate = startDate.clone().add(Number(timeOffDuration), 'weeks').subtract(1, 'day');

      const mockUpdateData = {
        reason: timeOffReason,
        startingDate: startDate.toDate(),
        endingDate: endDate.toDate(),
        duration: timeOffDuration,
      };

      mockReqCopy.body = {
        ...mockReqCopy.body,
        duration: timeOffDuration,
        startingDate: timeOffStartingDate,
        reason: timeOffReason,
      };

      hasPermission.mockImplementation(async () => true);
      const timeOffRequestFindByIdAndUpdateSpy = jest
        .spyOn(TimeOffRequest, 'findByIdAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(mockUpdateData));

      const response = await updateTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(200, mockUpdateData, response, mockRes);

      expect(hasPermission).toHaveBeenCalledWith(
        mockReqCopy.body.requestor,
        'manageTimeOffRequests',
      );
      expect(hasPermission).toHaveBeenCalledTimes(1);

      expect(timeOffRequestFindByIdAndUpdateSpy).toHaveBeenCalled();
      expect(timeOffRequestFindByIdAndUpdateSpy).toHaveBeenCalledTimes(1);
      expect(timeOffRequestFindByIdAndUpdateSpy).toHaveBeenCalledWith(
        mockReqCopy.params.id,
        mockUpdateData,
        {
          new: true,
        },
      );
    });

    test('Returns 500 if error occurs with findByIdAndUpdate ', async () => {
      const { updateTimeOffRequestById } = makeSut();

      // Creating a deep copy of the `mockReq`
      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.params.id = '123';

      mockReqCopy.body.requestor = {
        ...mockReqCopy.body.requestor,
        role: 'Owner',
        permissions: {
          frontPermissions: [],
          backPermissions: [],
        },
      };

      const timeOffDuration = 5;
      const timeOffStartingDate = new Date(2024, 5, 12);
      const timeOffReason = 'Testing a leave request';

      moment.tz.setDefault('America/Los_Angeles');
      const startDate = moment(timeOffStartingDate);
      const endDate = startDate.clone().add(Number(timeOffDuration), 'weeks').subtract(1, 'day');

      const mockUpdateData = {
        reason: timeOffReason,
        startingDate: startDate.toDate(),
        endingDate: endDate.toDate(),
        duration: timeOffDuration,
      };

      mockReqCopy.body = {
        ...mockReqCopy.body,
        duration: timeOffDuration,
        startingDate: timeOffStartingDate,
        reason: timeOffReason,
      };

      const error = new Error('Some error occcurred during operation findByIdAndUpdate()');

      hasPermission.mockImplementation(async () => true);
      const timeOffRequestFindByIdAndUpdateSpy = jest
        .spyOn(TimeOffRequest, 'findByIdAndUpdate')
        .mockRejectedValueOnce(error);

      const response = await updateTimeOffRequestById(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(500, error, response, mockRes);

      expect(hasPermission).toHaveBeenCalledWith(
        mockReqCopy.body.requestor,
        'manageTimeOffRequests',
      );
      expect(hasPermission).toHaveBeenCalledTimes(1);

      expect(timeOffRequestFindByIdAndUpdateSpy).toHaveBeenCalled();
      expect(timeOffRequestFindByIdAndUpdateSpy).toHaveBeenCalledTimes(1);
      expect(timeOffRequestFindByIdAndUpdateSpy).toHaveBeenCalledWith(
        mockReqCopy.params.id,
        mockUpdateData,
        {
          new: true,
        },
      );
    });
  });

  describe('setTimeOffRequest function', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(TimeOffRequest.prototype, 'save').mockResolvedValue(mockTimeOffRequest());
      jest.spyOn(emailSender, 'mockResolvedValueOnce').mockResolvedValue();
    });
    test('Returns 403 if the user is not authorised', async () => {
      const { setTimeOffRequest } = makeSut();

      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));

      mockReqCopy.body = {
        ...mockReqCopy.body,
        requestor: {
          role: 'Volunteer',
          requestorId: 'testUser123',
        },
        requestFor: 'testUser456',
      };

      hasPermission.mockImplementation(async () => Promise.resolve(false));

      const error = 'You are not authorized to set time off requests.';

      const response = await setTimeOffRequest(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
      expect(hasPermission).toBeCalled();
      expect(hasPermission).toBeCalledTimes(1);
      expect(hasPermission).toBeCalledWith(mockReqCopy.body.requestor, 'manageTimeOffRequests');
    });

    test.skip('Returns 201 if the time-off request is set successfully; emailSender is not called as setOwnRequested is False', async () => {
      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.body = {
        requestor: {
          role: 'Administrator',
          permissions: { backPermissions: ['manageTimeOffRequests'] },
          requestorId: 'testUser123',
        },
        requestFor: 'testUser456',
        duration: 1,
        startingDate: new Date(2024, 5, 1),
        reason: 'Vacation',
      };

      const mockData = {
        requestFor: 'testUser456',
        reason: 'Vacation',
        startingDate: new Date(2024, 5, 1),
        endingDate: new Date(2024, 5, 7),
        duration: 1,
      };

      jest.spyOn(TimeOffRequest.prototype, 'save').mockResolvedValue(mockData);
      hasPermission.mockResolvedValue(true);

      const response = await controller.setTimeOffRequest(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(201, mockData, response, mockRes);

      expect(emailSender).not.toHaveBeenCalled(); // Ensure emailSender is not called
    });

    test('Returns 201 if the time-off request is set successfully; emailSender is not called as savedRequest is null', async () => {
      // emailSender is not called as savedRequest is null
      const { setTimeOffRequest } = makeSut();

      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));

      mockReqCopy.body = {
        ...mockReqCopy.body,
        requestor: {
          role: 'Administrator',
          permissions: {
            frontPermissions: [],
            backPermissions: [],
          },
          requestorId: 'testUser123',
        },
        requestFor: 'testUser123',
        duration: 1,
        startingDate: new Date(2024, 5, 15),
        reason: 'Test set time off',
      };

      const mockedResponseDocument = null;

      hasPermission.mockImplementation(async () => Promise.resolve(true));
      const mongooseObjectIdSpy = jest
        .spyOn(mongoose.Types, 'ObjectId')
        .mockImplementationOnce(() => mockReqCopy.body.requestFor);
      const timeOffRequestSaveSpy = jest
        .spyOn(TimeOffRequest.prototype, 'save')
        .mockImplementationOnce(async () => Promise.resolve(mockedResponseDocument));

      const response = await setTimeOffRequest(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(201, mockedResponseDocument, response, mockRes);
      expect(hasPermission).toBeCalled();
      expect(hasPermission).toBeCalledTimes(1);
      expect(hasPermission).toBeCalledWith(mockReqCopy.body.requestor, 'manageTimeOffRequests');

      expect(mongooseObjectIdSpy).toBeCalled();
      expect(mongooseObjectIdSpy).toBeCalledTimes(1);
      expect(mongooseObjectIdSpy).toBeCalledWith(mockReqCopy.body.requestFor);

      expect(timeOffRequestSaveSpy).toBeCalled();
      expect(timeOffRequestSaveSpy).toBeCalledTimes(1);

      expect(emailSender).toHaveBeenCalledTimes(0);
    });

    test.skip('Returns 201 if the time-off request is set successfully; emailSender is called', async () => {
      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));
      mockReqCopy.body = {
        requestor: {
          role: 'Administrator',
          permissions: { backPermissions: ['manageTimeOffRequests'] },
          requestorId: 'user123',
        },
        requestFor: 'user123',
        duration: 1,
        startingDate: new Date(),
        reason: 'Vacation',
      };

      const mockData = {
        requestFor: 'user123',
        reason: 'Vacation',
        startingDate: new Date(),
        endingDate: new Date(),
        duration: 1,
      };

      jest.spyOn(TimeOffRequest.prototype, 'save').mockResolvedValue(mockData);
      hasPermission.mockResolvedValue(true);

      const response = await controller.setTimeOffRequest(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(201, mockData, response, mockRes);

      expect(emailSender).toHaveBeenCalledTimes(1); // Ensure emailSender is called once
    });

    test.each`
      duration    | startingDate              | reason       | requestFor   | expectedMessage
      ${null}     | ${new Date('2024-06-08')} | ${'Injury'}  | ${'user123'} | ${'bad request'}
      ${'5 week'} | ${null}                   | ${'Wedding'} | ${'user123'} | ${'bad request'}
      ${'7 week'} | ${new Date('2024-06-08')} | ${null}      | ${'user123'} | ${'bad request'}
      ${'1 week'} | ${new Date('2024-06-08')} | ${'Sick'}    | ${null}      | ${'bad request'}
    `(
      `Return 400 if request body is missing any one of the following $requestFor, $reason, $duration, or $startingDate`,
      async ({ duration, startingDate, reason, requestFor, expectedMessage }) => {
        const { setTimeOffRequest } = makeSut();

        hasPermission.mockImplementationOnce(async () => Promise.resolve(true));

        const mockReqCopy = JSON.parse(JSON.stringify(mockReq));

        mockReqCopy.body = {
          ...mockReqCopy.body,
          requestor: {
            role: 'Administrator',
            permissions: {
              frontPermissions: [],
              backPermissions: [],
            },
            requestorId: 'testUser123',
          },
          requestFor,
          duration,
          startingDate,
          reason,
        };

        const error = expectedMessage;
        const response = await setTimeOffRequest(mockReqCopy, mockRes);

        assertResMock(400, error, response, mockRes);

        expect(hasPermission).toBeCalled();
        expect(hasPermission).toBeCalledTimes(1);
        expect(hasPermission).toBeCalledWith(mockReqCopy.body.requestor, 'manageTimeOffRequests');
      },
    );

    test('Returns 500 if error occurs while saving time-off request.', async () => {
      const { setTimeOffRequest } = makeSut();

      const mockReqCopy = JSON.parse(JSON.stringify(mockReq));

      mockReqCopy.body = {
        ...mockReqCopy.body,
        requestor: {
          role: 'Administrator',
          permissions: {
            frontPermissions: [],
            backPermissions: [],
          },
          requestorId: 'testUser123',
        },
        requestFor: 'testUser456',
        duration: 1,
        startingDate: new Date(2024, 5, 15),
        reason: 'Test set time off',
      };

      const error = 'Error saving the request.';

      hasPermission.mockImplementation(async () => Promise.resolve(true));
      const mongooseObjectIdSpy = jest
        .spyOn(mongoose.Types, 'ObjectId')
        .mockImplementationOnce(() => mockReqCopy.body.requestFor);
      const timeOffRequestSaveSpy = jest
        .spyOn(TimeOffRequest.prototype, 'save')
        .mockRejectedValueOnce(error);

      const response = await setTimeOffRequest(mockReqCopy, mockRes);
      await flushPromises();

      assertResMock(500, error, response, mockRes);

      expect(hasPermission).toBeCalled();
      expect(hasPermission).toBeCalledTimes(1);
      expect(hasPermission).toBeCalledWith(mockReqCopy.body.requestor, 'manageTimeOffRequests');

      expect(mongooseObjectIdSpy).toBeCalled();
      expect(mongooseObjectIdSpy).toBeCalledTimes(1);
      expect(mongooseObjectIdSpy).toBeCalledWith(mockReqCopy.body.requestFor);

      expect(timeOffRequestSaveSpy).toBeCalled();
      expect(timeOffRequestSaveSpy).toBeCalledTimes(1);
    });
  });
});
