const permissionChangeLogController = require('./permissionChangeLogsController');
const permissionChangeLog = require('../models/permissionChangeLog');
const UserProfile = require('../models/userProfile');
const { mockRes, mockReq } = require('../test');

const makeSut = () => {
  const { getPermissionChangeLogs } = permissionChangeLogController(permissionChangeLog);

  return {
    getPermissionChangeLogs,
  };
};

const assertResMock = (statusCode, message, response) => {
  expect(mockRes.status).toHaveBeenCalledWith(statusCode);
  expect(mockRes.send).toHaveBeenCalledWith(message);
  expect(response).toBeUndefined();
};

describe('permissionChangeLogsController', () => {
  describe('getPermissionChangeLogs', () => {
    test('Ensure getPermissionChangeLogs Returns 403 if the user profile could not be found', async () => {
      const { getPermissionChangeLogs } = makeSut();

      mockReq.body.role = 'Admin';
      const errorMessage = `User (${mockReq.params.userId}) not found.`;

      jest.spyOn(UserProfile, 'findOne').mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(null),
      });
      const response = await getPermissionChangeLogs(mockReq, mockRes);

      assertResMock(403, errorMessage, response);
    });
    test('Ensure getPermissionChangeLogs Returns 400 if any error occurs', async () => {
      const { getPermissionChangeLogs } = makeSut();
      mockReq.body.role = 'Admin';

      const errorMessage = 'error message';

      jest.spyOn(UserProfile, 'findOne').mockReturnValueOnce({
        exec: jest.fn().mockRejectedValueOnce(new Error(errorMessage)),
      });
      const response = await getPermissionChangeLogs(mockReq, mockRes);
      assertResMock(400, errorMessage, response);
    });

    test('Ensure getPermissionChangeLogs Returns 204 if the user profile role is not Owner', async () => {
      const { getPermissionChangeLogs } = makeSut();

      mockReq.body.role = 'Admin';

      jest.spyOn(UserProfile, 'findOne').mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce([]),
      });

      const response = await getPermissionChangeLogs(mockReq, mockRes);

      assertResMock(204, [], response);
    });
  });

  test('Ensure getPermissionChangeLogs Returns 200 if the user profile role is Owner', async () => {
    const { getPermissionChangeLogs } = makeSut();

    const permissionChangeLogs = [{ id: 1, name: 'test' }];
    mockReq.body.role = 'Owner';

    jest.spyOn(UserProfile, 'findOne').mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce({ role: 'Owner' }),
    });

    jest
      .spyOn(permissionChangeLog, 'find')
      .mockResolvedValue(Promise.resolve(permissionChangeLogs));

    const response = await getPermissionChangeLogs(mockReq, mockRes);
    assertResMock(200, permissionChangeLogs, response);
  });
});
