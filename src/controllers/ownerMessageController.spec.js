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
  let mockSave;
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockFind = jest.spyOn(ownerMessage, 'find');
    mockSave = jest.fn();
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
  describe('updateOwnerMessage', () => {
    test('Ensures updateOwnerMessage returns status 403 if requestor is not an owner', async () => {
      const { updateOwnerMessage } = makeSut();
      const req = { body: { requestor: { role: 'User' } } };
      const response = await updateOwnerMessage(req, mockRes);
      await flushPromises();
      assertResMock(403, 'You are not authorized to create messages!', response, mockRes);
    });
    test('Ensures updateOwnerMessage returns status 201 and updates the owner message correctly with custom message', async () => {
      const existingMessage = { message: '', standardMessage: '', save: mockSave };
      mockFind.mockResolvedValue([existingMessage]);
      const mockReqDup = {
        ...mockReq,
        body: {
          ...mockReq.body,
          isStandard: false,
          newMessage: 'New custom message',
          requestor: { role: 'Owner' },
        },
      };
      await makeSut().updateOwnerMessage(mockReqDup, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.send).toHaveBeenCalledWith({
        _serverMessage: 'Update successfully!',
        ownerMessage: { standardMessage: '', message: 'New custom message' },
      });
      expect(mockSave).toHaveBeenCalled();
    });
    test('Ensures updateOwnerMessage returns status 500 if an error occurs during the update', async () => {
      const errorMsg = 'Error occurred during update';
      mockFind.mockRejectedValue(errorMsg);
      const mockReqDup = { ...mockReq, body: { ...mockReq.body, requestor: { role: 'Owner' } } };
      await makeSut().updateOwnerMessage(mockReqDup, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(errorMsg);
    });
  });
});
