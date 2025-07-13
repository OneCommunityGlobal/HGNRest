const PopUpEditor = require('../models/popupEditor');
const { mockReq, mockRes, assertResMock } = require('../test');

jest.mock('../utilities/permissions');

const helper = require('../utilities/permissions');
const popupEditorController = require('./popupEditorController');

const flushPromises = () => new Promise(setImmediate);

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

const makeSut = () => {
  const { getAllPopupEditors, getPopupEditorById, createPopupEditor, updatePopupEditor } =
    popupEditorController(PopUpEditor);
  return { getAllPopupEditors, getPopupEditorById, createPopupEditor, updatePopupEditor };
};

describe('popupEditorController Controller Unit tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe(`getAllPopupEditors function`, () => {
    test(`Should return 200 and popup editors on success`, async () => {
      const { getAllPopupEditors } = makeSut();
      const mockPopupEditors = [{ popupName: 'popup', popupContent: 'content' }];
      jest.spyOn(PopUpEditor, 'find').mockResolvedValue(mockPopupEditors);
      const response = await getAllPopupEditors(mockReq, mockRes);
      assertResMock(200, mockPopupEditors, response, mockRes);
    });

    test(`Should return 404 on error`, async () => {
      const { getAllPopupEditors } = makeSut();
      const error = new Error('Test Error');

      jest.spyOn(PopUpEditor, 'find').mockRejectedValue(error);
      const response = await getAllPopupEditors(mockReq, mockRes);
      await flushPromises();

      assertResMock(404, error, response, mockRes);
    });
  });

  describe(`getPopupEditorById function`, () => {
    test(`Should return 200 and popup editor on success`, async () => {
      const { getPopupEditorById } = makeSut();
      const mockPopupEditor = { popupName: 'popup', popupContent: 'content' };
      jest.spyOn(PopUpEditor, 'findById').mockResolvedValue(mockPopupEditor);
      const response = await getPopupEditorById(mockReq, mockRes);
      assertResMock(200, mockPopupEditor, response, mockRes);
    });

    test(`Should return 404 on error`, async () => {
      const { getPopupEditorById } = makeSut();
      const error = new Error('Test Error');

      jest.spyOn(PopUpEditor, 'findById').mockRejectedValue(error);
      const response = await getPopupEditorById(mockReq, mockRes);
      await flushPromises();

      assertResMock(404, error, response, mockRes);
    });
  });

  describe(`createPopupEditor function`, () => {
    test(`Should return 403 if user is not authorized`, async () => {
      const { createPopupEditor } = makeSut();
      mockHasPermission(false);
      const response = await createPopupEditor(mockReq, mockRes);
      assertResMock(
        403,
        { error: 'You are not authorized to create new popup' },
        response,
        mockRes,
      );
    });

    test(`Should return 400 if popupName or popupContent is missing`, async () => {
      const { createPopupEditor } = makeSut();
      mockHasPermission(true);
      const response = await createPopupEditor(mockReq, mockRes);
      assertResMock(
        400,
        { error: 'popupName , popupContent are mandatory fields' },
        response,
        mockRes,
      );
    });

    test(`Should return 201 and popup editor on success`, async () => {
      const { createPopupEditor } = makeSut();
      mockHasPermission(true);
      mockReq.body = { popupName: 'popup', popupContent: 'content' };
      const mockPopupEditor = { save: jest.fn().mockResolvedValue(mockReq.body) };
      jest.spyOn(PopUpEditor.prototype, 'save').mockImplementationOnce(mockPopupEditor.save);
      const response = await createPopupEditor(mockReq, mockRes);
      expect(mockPopupEditor.save).toHaveBeenCalled();
      assertResMock(201, mockReq.body, response, mockRes);
    });

    test(`Should return 500 on error`, async () => {
      const { createPopupEditor } = makeSut();
      mockHasPermission(true);
      const error = new Error('Test Error');

      jest.spyOn(PopUpEditor.prototype, 'save').mockRejectedValue(error);
      const response = await createPopupEditor(mockReq, mockRes);
      await flushPromises();

      assertResMock(500, { error }, response, mockRes);
    });

    test('Should call hasPermission with correct parameters on create', async () => {
      const { createPopupEditor } = makeSut();
      const spy = mockHasPermission(true);
      mockReq.body = { popupName: 'popup', popupContent: 'content', requestor: 'user123' };
      jest.spyOn(PopUpEditor.prototype, 'save').mockResolvedValue(mockReq.body);

      await createPopupEditor(mockReq, mockRes);

      expect(spy).toHaveBeenCalledWith('user123', 'createPopup');
    });
  });
  describe(`updatePopupEditor function`, () => {
    test(`Should return 403 if user is not authorized`, async () => {
      const { updatePopupEditor } = makeSut();
      mockHasPermission(false);
      const response = await updatePopupEditor(mockReq, mockRes);
      assertResMock(
        403,
        { error: 'You are not authorized to create new popup' },
        response,
        mockRes,
      );
    });

    test(`Should return 400 if popupContent is missing`, async () => {
      const { updatePopupEditor } = makeSut();
      mockReq.body = {};
      mockHasPermission(true);
      const response = await updatePopupEditor(mockReq, mockRes);
      assertResMock(400, { error: 'popupContent is mandatory field' }, response, mockRes);
    });

    test(`Should return 201 and popup editor on success`, async () => {
      const { updatePopupEditor } = makeSut();
      mockHasPermission(true);
      mockReq.body = { popupContent: 'content' };
      const mockPopupEditor = { save: jest.fn().mockResolvedValue(mockReq.body) };
      jest
        .spyOn(PopUpEditor, 'findById')
        .mockImplementationOnce((id, callback) => callback(null, mockPopupEditor));
      jest.spyOn(PopUpEditor.prototype, 'save').mockImplementationOnce(mockPopupEditor.save);
      const response = await updatePopupEditor(mockReq, mockRes);
      expect(mockPopupEditor.save).toHaveBeenCalled();
      assertResMock(201, mockReq.body, response, mockRes);
    });

    test('Should return 500 on popupEditor save error', async () => {
      const { updatePopupEditor } = makeSut();
      mockHasPermission(true);
      const err = new Error('Test Error');
      mockReq.body = { popupContent: 'content' };
      const mockPopupEditor = { save: jest.fn().mockRejectedValue(err) };
      jest
        .spyOn(PopUpEditor, 'findById')
        .mockImplementation((id, callback) => callback(null, mockPopupEditor));
      jest.spyOn(PopUpEditor.prototype, 'save').mockImplementationOnce(mockPopupEditor.save);
      const response = await updatePopupEditor(mockReq, mockRes);
      await flushPromises();
      assertResMock(500, { err }, response, mockRes);
    });

    test('Should call hasPermission with correct parameters on update', async () => {
      const { updatePopupEditor } = makeSut();
      const spy = mockHasPermission(true);
      mockReq.body = { popupContent: 'content', requestor: 'user123' };
      const mockPopupEditor = { save: jest.fn().mockResolvedValue(mockReq.body) };

      jest
        .spyOn(PopUpEditor, 'findById')
        .mockImplementationOnce((id, callback) => callback(null, mockPopupEditor));

      await updatePopupEditor(mockReq, mockRes);
      expect(spy).toHaveBeenCalledWith('user123', 'updatePopup');
    });

    test('Should handle null popup returned from findById', async () => {
      const { updatePopupEditor } = makeSut();
      mockHasPermission(true);
      mockReq.body = { popupContent: 'content' };

      jest
        .spyOn(PopUpEditor, 'findById')
        .mockImplementationOnce((id, callback) => callback(null, null));

      await updatePopupEditor(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
