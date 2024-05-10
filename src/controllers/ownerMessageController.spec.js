const ownerMessage = require('../models/ownerMessage');
const ownerMessageController = require('./ownerMessageController');
const { mockReq, mockRes, assertResMock } = require('../test');

const makeSut = () => {
  const { getOwnerMessage, updateOwnerMessage, deleteOwnerMessage } =
    ownerMessageController(ownerMessage);
  return {
    getOwnerMessage,
    updateOwnerMessage,
    deleteOwnerMessage,
  };
};
const flushPromises = () => new Promise(setImmediate);

describe('ownerMessageController Unit Tests', () => {
  let mockFind;
  // let mockSave;
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockFind = jest.spyOn(ownerMessage, 'find');
    // mockSave = jest.fn();
  });
  describe('getOwnerMessage', () => {
    test('Ensures getOwnerMessage returns status 404 if owner message cant be found', async () => {
      const { getOwnerMessage } = makeSut();
      const errorMsg = 'Error occurred when finding owner message';
      mockFind.mockImplementationOnce(() => Promise.reject(errorMsg));
      const response = await getOwnerMessage(mockReq, mockRes);
      await flushPromises();
      assertResMock(404, errorMsg, response, mockRes);
    });
    // test('Ensures getOwnerMessage returns status 200 with new owner message if none exist', async () => {
    //   mockFind.mockResolvedValue({});
    //   const ownerMessageInstance = {
    //     set: jest.fn(),
    //     save: mockSave,
    //   };

    //   jest.spyOn(ownerMessage.prototype, 'save').mockImplementation(() => ownerMessageInstance);
    //   await makeSut().getOwnerMessage(mockReq, mockRes);
    //   await flushPromises();

    //   expect(mockRes.status).toHaveBeenCalledWith(200);
    //   expect(mockRes.send).toHaveBeenCalledWith({ ownerMessage: ownerMessageInstance });
    //   expect(mockSave).toHaveBeenCalled();
    // });
    test('Ensures getOwnerMessage returns status 200 with the first owner message if it exists', async () => {
      const existingMessage = { message: 'Existing message', standardMessage: 'Standard message' };
      mockFind.mockResolvedValue([existingMessage]);
      await makeSut().getOwnerMessage(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({ ownerMessage: existingMessage });
    });
  });
});
