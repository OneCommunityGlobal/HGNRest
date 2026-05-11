const helper = require('../utilities/permissions');
const UserProfile = require('../models/userProfile');
const currentWarnings = require('../models/currentWarnings');
const { mockReq, mockRes } = require('../test');
const currentWarningsController = require('./currentWarningsController');

const makeSut = () => {
  const {
    getCurrentWarnings,
    postNewWarningDescription,
    updateWarningDescription,
    deleteWarningDescription,
    editWarningDescription,
    reorderWarningDescriptions,
  } = currentWarningsController(currentWarnings);

  return {
    getCurrentWarnings,
    postNewWarningDescription,
    updateWarningDescription,
    deleteWarningDescription,
    editWarningDescription,
    reorderWarningDescriptions,
  };
};

// meant for failed response
const assertResMock = (statusCode, message, response) => {
  expect(mockRes.status).toHaveBeenCalledWith(statusCode);
  expect(mockRes.send).toHaveBeenCalledWith(message);
  expect(response).toBeUndefined();
};

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementation(() => Promise.resolve(value));

// jest.mock('./helper', () => ({
//   helper: {
//     hasPermission: jest.fn(),
//   },
// }));

describe('current warnings controller module', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get current warnings method', () => {
    test('Ensure getCurrentWarnings returns error 401 if retrieving warnings fail', async () => {
      const { getCurrentWarnings } = makeSut();
      const errorMessage = 'Database Error';
      jest.spyOn(currentWarnings, 'find').mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('Database Error')),
      });
      const res = await getCurrentWarnings(mockReq, mockRes);
      assertResMock(401, { message: errorMessage }, res);
    });

    test('Ensure getCurrentWarnings returns error 400 if no warnings are found', async () => {
      const { getCurrentWarnings } = makeSut();
      jest.spyOn(currentWarnings, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValueOnce([]),
      });
      const res = await getCurrentWarnings(mockReq, mockRes);
      assertResMock(400, { message: 'No records', response: [] }, res);
    });

    test('Ensure getCurrentWarnings returns warning list', async () => {
      const { getCurrentWarnings } = makeSut();
      const testWarnings = [{ order: 1 }, { order: 2 }];
      jest.spyOn(currentWarnings, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValueOnce([{ order: 1 }, { order: 2 }]),
      });
      const res = await getCurrentWarnings(mockReq, mockRes);
      assertResMock(200, { currentWarningDescriptions: testWarnings }, res);
    });
  });

  describe('post new warning description method', () => {
    test('Ensure postNewWarningDescription returns error 403 if user does not have required permissions', async () => {
      const { postNewWarningDescription } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const res = await postNewWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      assertResMock(403, 'You are not authorized to add a new WarningTracker.', res, mockRes);
    });

    test('Ensure postNewWarningDescription returns error 400 if warning title provided has special character as their first letter', async () => {
      mockReq.body.newWarning = '#new';
      mockReq.body.isPermanent = true;
      mockReq.body.activeWarning = true;
      const { postNewWarningDescription } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);
      const res = await postNewWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      assertResMock(
        400,
        { error: 'Warnings cannot have special characters as the first letter' },
        res,
        mockRes,
      );
    });
  });

  describe('update warning description method', () => {
    test('Ensure updateWarningDescription returns error 403 if user does not have required permissions', async () => {
      const { updateWarningDescription } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const res = await updateWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReq.body.requestor,
        'reactivateWarningTracker',
      );
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReq.body.requestor,
        'deactivateWarningTracker',
      );
      assertResMock(
        403,
        'You are not authorized to reactivate a WarningTracker or deactivate warning tracker.',
        res,
        mockRes,
      );
    });
  });
  describe('reorder new warning description method', () => {
    test('Ensure reorderWarningDescriptions returns error 403 if user does not have required permissions', async () => {
      const { reorderWarningDescriptions } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const res = await reorderWarningDescriptions(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteWarningTracker');
      console.log('mockReq: ', mockReq);
      assertResMock(
        403,
        'You are not authorized to edit the order of the WarningTrackers.',
        res,
        mockRes,
      );
    });
  });
});
