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

});
