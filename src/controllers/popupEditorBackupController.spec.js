const popupEditorBackupController = require('./popupEditorBackupController');
const { mockReq, mockRes, assertResMock } = require('../test');
const PopupEditorBackups = require('../models/popupEditorBackup');
const helper = require('../utilities/permissions');

const makeSut = () => {
  const { createPopupEditorBackup, getAllPopupEditorBackups, getPopupEditorBackupById } =
    popupEditorBackupController(PopupEditorBackups);
  return { createPopupEditorBackup, getAllPopupEditorBackups, getPopupEditorBackupById };
};

const flushPromises = () => new Promise(setImmediate);
describe('popupEditorBackup Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReq.params.id = '6437f9af9820a0134ca79c5e';
  });
  describe('createPopupEditorBackup method', () => {
    test("Ensure createPopupEditorBackup returns 403 if user doesn't have permissions for createPopup", async () => {
      const { createPopupEditorBackup } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(false));

      const response = await createPopupEditorBackup(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createPopup');

      assertResMock(
        403,
        { error: 'You are not authorized to create new popup' },
        response,
        mockRes,
      );
    });
    test('Ensure createPopupEditorBackup returns 400 if missing popupName', async () => {
      const { createPopupEditorBackup } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));

      const newMockReq = {
        body: {
          ...mockReq.body,
          popupContent: 'some popupContent',
        },
      };
      const response = await createPopupEditorBackup(newMockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createPopup');

      assertResMock(
        400,
        {
          error: 'popupName , popupContent are mandatory fields',
        },
        response,
        mockRes,
      );
    });
    test('Ensure createPopupEditorBackup returns 400 if missing popupContent', async () => {
      const { createPopupEditorBackup } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));

      const newMockReq = {
        body: {
          ...mockReq.body,
          popupName: 'some popupName',
        },
      };
      const response = await createPopupEditorBackup(newMockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createPopup');

      assertResMock(
        400,
        {
          error: 'popupName , popupContent are mandatory fields',
        },
        response,
        mockRes,
      );
    });
    test('Ensure createPopupEditorBackup returns 500 if any error in saving', async () => {
      const { createPopupEditorBackup } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));

      const newMockReq = {
        body: {
          ...mockReq.body,
          popupId: 'randomId334',
          popupName: 'some popupName',
          popupContent: 'some popupContent',
        },
      };
      jest
        .spyOn(PopupEditorBackups.prototype, 'save')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when saving')));
      const response = await createPopupEditorBackup(newMockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createPopup');

      assertResMock(
        500,
        {
          error: new Error('Error when saving'),
        },
        response,
        mockRes,
      );
    });
    test('Ensure createPopupEditorBackup returns 201 if create new popup successfully', async () => {
      const { createPopupEditorBackup } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const data = {
        popupId: 'test randomId334',
        popupName: 'testpopupName',
        popupContent: 'test popupContent',
      };
      const newMockReq = {
        body: {
          ...mockReq.body,
          popupId: 'randomId334',
          popupName: 'some popupName',
          popupContent: 'some popupContent',
        },
      };
      jest
        .spyOn(PopupEditorBackups.prototype, 'save')
        .mockImplementationOnce(() => Promise.resolve(data));
      const response = await createPopupEditorBackup(newMockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'createPopup');

      assertResMock(201, data, response, mockRes);
    });
  });
  describe('getAllPopupEditorBackups method', () => {
    test('Ensure getAllPopupEditorBackup returns 400 if error in finding', async () => {
      const { getAllPopupEditorBackups } = makeSut();
      jest
        .spyOn(PopupEditorBackups, 'find')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when finding')));
      const response = getAllPopupEditorBackups(mockReq, mockRes);
      await flushPromises();

      assertResMock(404, new Error('Error when finding'), response, mockRes);
    });
    test('Ensure getAllPopupEditorBackup returns 200 if get all popupeditor backups successfully', async () => {
      const { getAllPopupEditorBackups } = makeSut();
      const data = {
        poupEditorId: 'randomId345',
      };
      jest.spyOn(PopupEditorBackups, 'find').mockImplementationOnce(() => Promise.resolve(data));
      const response = getAllPopupEditorBackups(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, data, response, mockRes);
    });
  });
  describe('getPopupEditorBackupById method', () => {
    test('Ensure getPopupEditorBackupById returns 404 if error in finding', async () => {
      const { getPopupEditorBackupById } = makeSut();

      const findByIdSpy = jest
        .spyOn(PopupEditorBackups, 'find')
        .mockImplementationOnce((_, cb) => cb(true, null));

      getPopupEditorBackupById(mockReq, mockRes);
      await flushPromises();

      expect(findByIdSpy).toHaveBeenCalledWith(
        { popupId: { $in: mockReq.params.id } },
        expect.anything(),
      );
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
    test('Ensure getPopupEditorBackupById returns 200 ifget popupEditorBackup by id successfully', async () => {
      const { getPopupEditorBackupById } = makeSut();
      const data = [
        {
          popupId: 'test randomId334',
          popupName: 'testpopupName',
          popupContent: 'test popupContent',
        },
        {
          popupId: 'test randomId335',
          popupName: 'testpopupName5',
          popupContent: 'test popupContent5',
        },
      ];
      const findByIdSpy = jest
        .spyOn(PopupEditorBackups, 'find')
        .mockImplementationOnce((_, cb) => cb(false, data));

      const response = getPopupEditorBackupById(mockReq, mockRes);
      await flushPromises();
      expect(findByIdSpy).toHaveBeenCalledWith(
        { popupId: { $in: mockReq.params.id } },
        expect.anything(),
      );
      assertResMock(200, data[0], response, mockRes);
    });
  });
});
