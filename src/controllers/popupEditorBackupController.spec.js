const popupEditorBackupController = require('./popupEditorBackupController');
const { mockReq, mockRes, assertResMock } = require('../test');
const PopupEditorBackups = require('../models/popupEditorBackup');
const helper = require('../utilities/permissions');

const makeSut = () => {
  const {
    createPopupEditorBackup,
    getAllPopupEditorBackups,
    getPopupEditorBackupById,
    updatePopupEditorBackup,
  } = popupEditorBackupController(PopupEditorBackups);
  return {
    createPopupEditorBackup,
    getAllPopupEditorBackups,
    getPopupEditorBackupById,
    updatePopupEditorBackup,
  };
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
        ...mockReq,
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
        ...mockReq,
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
        ...mockReq,
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
        ...mockReq,
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
        .spyOn(PopupEditorBackups, 'findById')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when finding by id')));

      const response = await getPopupEditorBackupById(mockReq, mockRes);
      await flushPromises();
      assertResMock(404, new Error('Error when finding by id'), response, mockRes);
      expect(findByIdSpy).toHaveBeenCalledWith(mockReq.params.id);
    });
    test('Ensure getPopupEditorBackupById returns 200 ifget popupEditorBackup by id successfully', async () => {
      const { getPopupEditorBackupById } = makeSut();
      const data = {
        popupId: 'test randomId334',
        popupName: 'testpopupName',
        popupContent: 'test popupContent',
      };
      const findByIdSpy = jest
        .spyOn(PopupEditorBackups, 'findById')
        .mockImplementationOnce(() => Promise.resolve(data));

      const response = await getPopupEditorBackupById(mockReq, mockRes);
      await flushPromises();
      expect(findByIdSpy).toHaveBeenCalledWith(mockReq.params.id);
      assertResMock(200, data, response, mockRes);
    });
  });
  describe('updatePopupEditorBackup method', () => {
    test("Ensure updatePopupEditorBackup returns 403 if user doesn't have permissions for createPopup", async () => {
      const { updatePopupEditorBackup } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(false));

      const response = await updatePopupEditorBackup(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'updatePopup');

      assertResMock(
        403,
        { error: 'You are not authorized to create new popup' },
        response,
        mockRes,
      );
    });
    test('Ensure updatePopupEditorBackup returns 400 if missing popupContent', async () => {
      const { updatePopupEditorBackup } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));

      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          popupId: 'randomId334',
          popupName: 'some popupName',
        },
      };

      const response = await updatePopupEditorBackup(newMockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'updatePopup');
      assertResMock(400, { error: 'popupContent is mandatory field' }, response, mockRes);
    });
    test('Ensure updatePopupEditorBackup returns 500 if error in finding', async () => {
      const { updatePopupEditorBackup } = makeSut();
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          popupId: 'randomId334',
          popupName: 'some popupName',
          popupContent: 'some popupContent',
        },
      };
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const findByIdSpy = jest
        .spyOn(PopupEditorBackups, 'find')
        .mockImplementationOnce((_, cb) => cb(true, null));

      await updatePopupEditorBackup(newMockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'updatePopup');
      expect(findByIdSpy).toHaveBeenCalledWith(
        { popupId: { $in: mockReq.params.id } },
        expect.anything(),
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
    test('Ensure updatePopupEditorBackup returns 201 if no find and update successfully', async () => {
      const { updatePopupEditorBackup } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          popupId: 'randomId334',
          popupName: 'some popupName',
          popupContent: 'update popupContent',
        },
      };
      const data = {
        popupId: 'randomId334',
        popupName: 'some popupName',
        popupContent: 'some popupContent',
      };

      const findByIdSpy = jest
        .spyOn(PopupEditorBackups, 'find')
        .mockImplementationOnce((_, cb) => cb(null, []));
      const saveSpy = jest
        .spyOn(PopupEditorBackups.prototype, 'save')
        .mockImplementationOnce(() => Promise.resolve(data));
      const response = await updatePopupEditorBackup(newMockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'updatePopup');
      expect(findByIdSpy).toHaveBeenCalledWith(
        { popupId: { $in: mockReq.params.id } },
        expect.anything(),
      );
      expect(saveSpy).toHaveBeenCalledWith();
      assertResMock(201, data, response, mockRes);
    });
    test('Ensure updatePopupEditorBackup returns 500 if no find and any error in saving', async () => {
      const { updatePopupEditorBackup } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          popupId: 'randomId334',
          popupName: 'some popupName',
          popupContent: 'some popupContent',
        },
      };
      const findByIdSpy = jest
        .spyOn(PopupEditorBackups, 'find')
        .mockImplementationOnce((_, cb) => cb(null, []));
      const saveSpy = jest
        .spyOn(PopupEditorBackups.prototype, 'save')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when saving')));
      const response = await updatePopupEditorBackup(newMockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'updatePopup');
      expect(findByIdSpy).toHaveBeenCalledWith(
        { popupId: { $in: mockReq.params.id } },
        expect.anything(),
      );
      expect(saveSpy).toHaveBeenCalledWith();
      assertResMock(
        500,
        {
          err: new Error('Error when saving'),
        },
        response,
        mockRes,
      );
    });
    test('Ensure updatePopupEditorBackup returns 201 if find some and update successfully', async () => {
      const { updatePopupEditorBackup } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          popupId: '6437f9af9820a0134ca79c5e',
          popupName: 'some popupName',
          popupContent: 'update popupContent',
        },
      };
      const updateData = {
        popupId: 'randomId334',
        popupName: 'some popupName',
        popupContent: 'update popupContent',
      };
      const findData = [
        {
          popupId: '6437f9af9820a0134ca79c5e',
          popupName: 'some popupName',
          popupContent: 'some popupContent',
          save: jest.fn().mockImplementationOnce(() => Promise.resolve(updateData)),
        },
      ];
      const findByIdSpy = jest
        .spyOn(PopupEditorBackups, 'find')
        .mockImplementationOnce((_, cb) => cb(null, findData));
      const response = await updatePopupEditorBackup(newMockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'updatePopup');
      expect(findByIdSpy).toHaveBeenCalledWith(
        { popupId: { $in: mockReq.params.id } },
        expect.anything(),
      );
      expect(findData[0].save).toHaveBeenCalledWith();
      assertResMock(201, updateData, response, mockRes);
    });
  });
});
