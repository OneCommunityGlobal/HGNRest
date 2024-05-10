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
    afterEach(()=> {
        jest.clearAllMocks();
    })
  describe('getOwnerMessage', () => {
    test('Ensures getOwnerMessage returns status 404 if owner message cant be found', async () => {
      const { getOwnerMessage } = makeSut();
      const errorMsg = 'Error occurred when finding owner message';
      jest.spyOn(ownerMessage, 'find').mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));
      const response = await getOwnerMessage(mockReq, mockRes);
      await flushPromises();
      assertResMock(404, new Error(errorMsg), response, mockRes);
    });
    test('Ensures getOwnerMessage returns status 200 OK with new owner message if none exists and saves it', async () => {
        const { getOwnerMessage } = makeSut();
        jest.spyOn(ownerMessage, 'find').mockResolvedValueOnce([]);
        const expectedMessage = {

          };
        const mockSave = jest.fn().mockResolvedValue(expectedMessage);
        jest.spyOn(ownerMessage.prototype, 'save').mockImplementation(mockSave);
        const response =  await getOwnerMessage(mockReq, mockRes);
        await flushPromises();
        assertResMock(200, mockSave, response, mockRes);
    })
  });
});
