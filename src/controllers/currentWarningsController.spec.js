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
      assertResMock(403, 'You are not authorized to add a new WarningTracker.', res);
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
      );
    });

    test('Ensure postNewWarningDescription returns error 401 if error occurs during database query', async () => {
      mockReq.body.newWarning = 'new';
      mockReq.body.isPermanent = true;
      mockReq.body.activeWarning = true;
      const { postNewWarningDescription } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

      jest
        .spyOn(currentWarnings, 'exists')
        .mockRejectedValueOnce(new Error('Error in database connection'));

      const res = await postNewWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      assertResMock(401, { message: 'Error in database connection' }, res);
    });

    test('Ensure postNewWarningDescription returns error 400 if warning already exists', async () => {
      const testWarning = 'new';
      mockReq.body.newWarning = testWarning;
      mockReq.body.isPermanent = true;
      mockReq.body.activeWarning = true;
      const { postNewWarningDescription } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

      jest.spyOn(currentWarnings, 'exists').mockResolvedValueOnce(testWarning);

      const res = await postNewWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      assertResMock(400, { error: 'Warning already exists, please try a different name' }, res);
    });

    test('Ensure postNewWarningDescription returns error 201 if warning creation was successful', async () => {
      const testWarning = { newWarning: 'example', isPermanent: true, activeWarning: true };
      mockReq.body.newWarning = testWarning.newWarning;
      mockReq.body.isPermanent = testWarning.isPermanent;
      mockReq.body.activeWarning = testWarning.activeWarning;
      const { postNewWarningDescription } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

      jest.spyOn(currentWarnings, 'exists').mockResolvedValueOnce(null);
      const saveSpy = jest.spyOn(currentWarnings.prototype, 'save').mockResolvedValue(testWarning);
      jest.spyOn(currentWarnings, 'find').mockResolvedValueOnce(testWarning);

      const res = await postNewWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      expect(saveSpy).toHaveBeenCalledTimes(1);
      assertResMock(201, { newWarnings: testWarning }, res);
    });
  });

  describe('update warning description method', () => {
    test('Ensure updateWarningDescription returns error 403 if user does not have required permissions', async () => {
      const { updateWarningDescription } = makeSut();

      const hasPermissionSpy = mockHasPermission(false);
      jest.spyOn(currentWarnings, 'find').mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('Database Error')),
      });

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
      );
    });

    test('Ensure updateWarningDescription returns error 401 if error occurs while updating a warning description', async () => {
      const { updateWarningDescription } = makeSut();
      const testId = '10a49cb302a54ffe00b3aa5c';
      mockReq.params.warningDescriptionId = testId;
      const hasPermissionSpy = mockHasPermission(true);
      const errMsg = 'Warning does not exist';

      const findOneAndUpdateSpy = jest
        .spyOn(currentWarnings, 'findOneAndUpdate')
        .mockRejectedValue(new Error(errMsg));

      const res = await updateWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReq.body.requestor,
        'reactivateWarningTracker',
      );
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { _id: testId },
        [{ $set: { activeWarning: { $not: '$activeWarning' } } }],
        { new: true },
      );
      assertResMock(401, { message: 'Warning does not exist' }, res);
    });

    test('Ensure updateWarningDescription returns 201 if warning description was updated', async () => {
      const { updateWarningDescription } = makeSut();
      const testId = '10a49cb302a54ffe00b3aa5c';
      mockReq.params.warningDescriptionId = testId;
      const hasPermissionSpy = mockHasPermission(true);

      const findOneAndUpdateSpy = jest
        .spyOn(currentWarnings, 'findOneAndUpdate')
        .mockReturnValue([]);

      const res = await updateWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReq.body.requestor,
        'reactivateWarningTracker',
      );
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { _id: testId },
        [{ $set: { activeWarning: { $not: '$activeWarning' } } }],
        { new: true },
      );
      assertResMock(201, { message: 'warning description was updated' }, res);
    });
  });

  describe('reorder new warning description method', () => {
    test('Ensure reorderWarningDescriptions returns error 403 if user does not have required permissions', async () => {
      const { reorderWarningDescriptions } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const res = await reorderWarningDescriptions(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteWarningTracker');
      assertResMock(403, 'You are not authorized to edit the order of the WarningTrackers.', res);
    });

    test('Ensure reorderWarningDescriptions returns error 401 if no warnings are found', async () => {
      const { reorderWarningDescriptions } = makeSut();
      const errMsg = 'No warning descriptions found';
      const hasPermissionSpy = mockHasPermission(true);

      jest.spyOn(currentWarnings, 'find').mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error(errMsg)),
      });

      const res = await reorderWarningDescriptions(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      assertResMock(401, { message: errMsg }, res);
    });

    test('Ensure reorderWarningDescriptions returns 201 if warning descriptions were successfully reordered', async () => {
      const { reorderWarningDescriptions } = makeSut();
      const reorderedWarningDescriptions = [
        { _id: '1', warningTitle: 'test1', order: 2 },
        { _id: '2', warningTitle: 'test2', order: 1 },
      ];
      mockReq.body.warningDescriptions = reorderedWarningDescriptions;
      const testOrder = [
        { _id: '1', warningTitle: 'test1', order: 1 },
        { _id: '2', warningTitle: 'test2', order: 2 },
      ];
      const hasPermissionSpy = mockHasPermission(true);

      jest.spyOn(currentWarnings, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValueOnce(testOrder),
      });
      jest.spyOn(currentWarnings, 'bulkWrite').mockReturnValue({
        updateOne: jest.fn().mockResolvedValue(reorderWarningDescriptions),
      });

      const res = await reorderWarningDescriptions(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      assertResMock(201, { reorderedWarningDescriptions }, res);
    });
  });

  describe('edit warning description method', () => {
    test('Ensure editWarningDescription returns error 403 if user does not have required permissions', async () => {
      const { editWarningDescription } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const res = await editWarningDescription(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteWarningTracker');

      assertResMock(403, 'You are not authorized to edit a WarningTracker.', res);
    });

    test('Ensure editWarningDescription returns error 400 if warning title provided has special character as their first letter', async () => {
      mockReq.body.editedWarning = { warningTitle: '#new' };
      mockReq.body.isPermanent = true;
      mockReq.body.activeWarning = true;
      const { editWarningDescription } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      const res = await editWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');

      assertResMock(
        400,
        { error: 'Warning cannot have special characters as the first letter' },
        res,
      );
    });

    test('Ensure editWarningDescription returns error 400 if a warning provided warning title provided already exists', async () => {
      mockReq.body.editedWarning = { warningTitle: 'new' };
      const { editWarningDescription } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

      jest.spyOn(currentWarnings, 'exists').mockResolvedValueOnce(true);

      const res = await editWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      assertResMock(400, { error: 'Warning already exists, please try a different name' }, res);
    });

    test('Ensure editWarningDescription returns error 401 if an error occurs in the database', async () => {
      mockReq.body.editedWarning = { warningTitle: 'new', _id: '3ef6476ae32b4c6f45dc67ac' };
      const { editWarningDescription } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

      jest.spyOn(currentWarnings, 'exists').mockResolvedValueOnce(false);
      jest
        .spyOn(currentWarnings, 'findOne')
        .mockRejectedValueOnce(new Error('Error occcured with database connection.'));

      const res = await editWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      assertResMock(401, { message: 'Error occcured with database connection.' }, res);
    });

    test('Ensure editWarningDescription returns error 400 if no warning found', async () => {
      mockReq.body.editedWarning = { warningTitle: 'new', _id: '3ef6476ae32b4c6f45dc67ac' };
      const { editWarningDescription } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      jest.spyOn(currentWarnings, 'exists').mockResolvedValueOnce(false);
      jest.spyOn(currentWarnings, 'findOne').mockResolvedValueOnce(null);

      const res = await editWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      assertResMock(400, { message: 'Warning not found.' }, res);
    });

    test('Ensure editWarningDescription returns error 201 if editing warningTitle of warning description was successful', async () => {
      const testWarning = { warningTitle: 'new', _id: '3ef6476ae32b4c6f45dc67ac' };
      mockReq.body.editedWarning = testWarning;
      const { editWarningDescription } = makeSut();
      const warningObj = { save: () => {} };

      const hasPermissionSpy = mockHasPermission(true);
      jest.spyOn(currentWarnings, 'exists').mockResolvedValueOnce(false);
      jest.spyOn(currentWarnings, 'findOne').mockResolvedValueOnce(warningObj);
      jest.spyOn(warningObj, 'save').mockResolvedValueOnce(testWarning);

      const res = await editWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'addWarningTracker');
      assertResMock(201, { message: 'warning description was updated' }, res);
    });
  });

  describe('delete warning description method', () => {
    test('Ensure deleteWarningDescription returns error 403 if user does not have required permissions', async () => {
      const { deleteWarningDescription } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const res = await deleteWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteWarningTracker');
      assertResMock(403, 'You are not authorized to delete a WarningTracker.', res);
    });

    test('Ensure deleteWarningDescription returns error 401 if error occurs during deletion', async () => {
      const { deleteWarningDescription } = makeSut();
      const testId = '10a49cb302a54ffe00b3aa5c';
      mockReq.params.warningDescriptionId = testId;
      const errMsg = 'Warning id does not exist';

      const hasPermissionSpy = mockHasPermission(true);
      const findByIdSpy = jest
        .spyOn(currentWarnings, 'findById')
        .mockRejectedValueOnce(new Error(errMsg));

      const res = await deleteWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteWarningTracker');
      expect(findByIdSpy).toHaveBeenCalledWith(testId);
      assertResMock(401, { message: errMsg }, res);
    });

    test('Ensure deleteWarningDescription returns error 200 if warning description was deleted successfully', async () => {
      const { deleteWarningDescription } = makeSut();
      const testId = '10a49cb302a54ffe00b3aa5c';
      mockReq.params.warningDescriptionId = testId;
      const testWarningTitle = 'Test3';

      const hasPermissionSpy = mockHasPermission(true);
      const findByIdSpy = jest
        .spyOn(currentWarnings, 'findById')
        .mockResolvedValueOnce({ _id: testId, warningTitle: testWarningTitle });
      jest.spyOn(currentWarnings, 'deleteOne').mockResolvedValueOnce({});
      const updateManySpy = jest.spyOn(UserProfile, 'updateMany').mockResolvedValueOnce([]);

      await deleteWarningDescription(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteWarningTracker');
      expect(findByIdSpy).toHaveBeenCalledWith(testId);
      expect(updateManySpy).toHaveBeenCalledWith(
        { 'warnings.description': testWarningTitle },
        { $pull: { warnings: { description: testWarningTitle } } },
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
