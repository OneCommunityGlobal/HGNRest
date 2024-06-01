const mouseoverTextController = require('./mouseoverTextController');
const { mockReq, mockRes, assertResMock } = require('../test');
const MouseoverText = require('../models/mouseoverText');

const makeSut = () => {
  const { createMouseoverText, getMouseoverText, updateMouseoverText } =
    mouseoverTextController(MouseoverText);
  return { createMouseoverText, getMouseoverText, updateMouseoverText };
};
const flushPromises = () => new Promise(setImmediate);
describe('mouseoverText Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReq.params.id = '6237f9af9820a0134ca79c5g';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMouseoverText method', () => {
    test('Ensure createMouseoverText returns 500 if any error when saving new mouseoverText', async () => {
      const { createMouseoverText } = makeSut();
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          newMouseoverText: 'some mouseoverText',
        },
      };
      jest
        .spyOn(MouseoverText.prototype, 'save')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when saving')));

      const response = createMouseoverText(newMockReq, mockRes);
      await flushPromises();

      assertResMock(500, new Error('Error when saving'), response, mockRes);
    });
    test('Ensure createMouseoverText returns 201 if create new mouseoverText successfully', async () => {
      const { createMouseoverText } = makeSut();
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          newMouseoverText: 'new mouseoverText',
        },
      };
      jest
        .spyOn(MouseoverText.prototype, 'save')
        .mockResolvedValueOnce({ _id: '123random', mouseoverText: 'new mouseoverText' });

      createMouseoverText(newMockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.send).toHaveBeenCalledWith({
        _serverMessage: 'MouseoverText successfully created!',
        mouseoverText: {
          _id: '123random',
          mouseoverText: newMockReq.body.newMouseoverText,
        },
      });
    });
  });
  describe('getMouseoverText method', () => {
    test('Ensure getMouseoverText returns 404 if any error when finding the mouseoverText', async () => {
      const { getMouseoverText } = makeSut();
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          mouseoverText: 'some mouseoverText',
        },
      };
      jest
        .spyOn(MouseoverText, 'find')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when finding')));

      const response = getMouseoverText(newMockReq, mockRes);
      await flushPromises();

      assertResMock(404, new Error('Error when finding'), response, mockRes);
    });
    test('Ensure getMouseoverText returns 200 if get the mouseoverText successfully', async () => {
      const { getMouseoverText } = makeSut();
      const data = {
        mouseoverText: 'some get mouseoverText',
      };
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          mouseoverText: 'get mouseoverText',
        },
      };
      jest.spyOn(MouseoverText, 'find').mockImplementationOnce(() => Promise.resolve(data));
      const response = getMouseoverText(newMockReq, mockRes);
      await flushPromises();

      assertResMock(200, data, response, mockRes);
    });
  });
  describe('updateMouseoverText method', () => {
    test('Ensure updateMouseoverText returns 500 if any error when finding the mouseoverText by Id', async () => {
      const { updateMouseoverText } = makeSut();
      const findByIdSpy = jest
        .spyOn(MouseoverText, 'findById')
        .mockImplementationOnce((_, cb) => cb(true, null));
      const response = updateMouseoverText(mockReq, mockRes);
      await flushPromises();

      assertResMock(500, { error: 'MouseoverText not found with the given ID' }, response, mockRes);
      expect(findByIdSpy).toHaveBeenCalledWith(mockReq.params.id, expect.anything());
    });
    test('Ensure updateMouseoverText returns 400 if any error when saving the mouseoverText', async () => {
      const { updateMouseoverText } = makeSut();
      const data = {
        mouseoverText: 'old mouseoverText',
        save: () => {},
      };
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          newMouseoverText: 'some new mouseoverText',
        },
      };
      const findByIdSpy = jest
        .spyOn(MouseoverText, 'findById')
        .mockImplementationOnce((_, cb) => cb(false, data));
      jest.spyOn(data, 'save').mockRejectedValueOnce(new Error('Error when saving'));
      const response = updateMouseoverText(newMockReq, mockRes);
      await flushPromises();
      expect(findByIdSpy).toHaveBeenCalledWith(mockReq.params.id, expect.anything());
      assertResMock(400, new Error('Error when saving'), response, mockRes);
    });
    test('Ensure updateMouseoverText returns 201 if updating mouseoverText successfully', async () => {
      const { updateMouseoverText } = makeSut();
      const data = {
        mouseoverText: 'some get mouseoverText',
        save: () => {},
      };
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          newMouseoverText: 'some new mouseoverText',
        },
      };
      const findByIdSpy = jest
        .spyOn(MouseoverText, 'findById')
        .mockImplementationOnce((_, cb) => cb(false, data));
      jest.spyOn(data, 'save').mockResolvedValueOnce(data);
      const response = updateMouseoverText(newMockReq, mockRes);
      await flushPromises();
      expect(findByIdSpy).toHaveBeenCalledWith(mockReq.params.id, expect.anything());
      assertResMock(201, data, response, mockRes);
    });
  });
});
