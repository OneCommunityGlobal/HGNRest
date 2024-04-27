const Team = require('../models/team');
const teamController = require('./teamController');
const { mockReq, mockRes } = require('../test');
const helper = require('../utilities/permissions');
const userProfile = require('../models/userProfile');

const makeSut = () => {
  const { deleteTeam } = teamController(Team);
  return {
    deleteTeam,
  };
};

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

const flushPromises = () => new Promise(setImmediate);

describe('teamController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const sortObject = {
    sort: () => {},
  };

  const error = new Error('any error');

  describe.only('deleteTeam', () => {
    test('Return 403 when the requestor lacks deleteTeam permission', async () => {
      const { deleteTeam } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const response = await deleteTeam(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteTeam');
      assertResMock(403, { error: 'You are not authorized to delete teams.' }, response, mockRes);
    });

    test('Return 400 when no valid team record is found', async () => {
      const { deleteTeam } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

      jest.spyOn(Team, 'findById').mockImplementation((id, callback) => callback(null, null));

      const response = await deleteTeam(mockReq, mockRes);
      await flushPromises();

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteTeam');
      assertResMock(400, { error: 'No valid records found' }, response, mockRes);
    });

    test('Return 400 when an error occurs during the team deletion process', async () => {
      const { deleteTeam } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);
      const teamId = 'existingTeamId';

      jest.spyOn(Team, 'findById').mockImplementation((id, callback) =>
        callback(null, {
          _id: teamId,
          remove: () => Promise.resolve(),
        }),
      );

      jest.spyOn(userProfile, 'updateMany').mockImplementation(() => ({
        exec: jest.fn().mockRejectedValue(error),
      }));

      const response = await deleteTeam(mockReq, mockRes);

      await flushPromises();

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteTeam');
      assertResMock(400, { error: expect.anything() }, response, mockRes);
    });

    test('Return 200 when a team is successfully deleted and user profiles are updated', async () => {
      const { deleteTeam } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);
      const teamId = 'existingTeamId';

      jest.spyOn(Team, 'findById').mockImplementation((id, callback) =>
        callback(null, {
          _id: teamId,
          remove: () => Promise.resolve(),
        }),
      );

      jest.spyOn(userProfile, 'updateMany').mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue({
          matchedCount: 1,
          modifiedCount: 1,
        }),
      }));

      await deleteTeam(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteTeam');
      assertResMock(
        200,
        { message: 'Team successfully deleted and user profiles updated' },
        response,
        mockRes,
      );
    });
  });
});
