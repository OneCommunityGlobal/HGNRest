/* eslint-disable import/order */
const mongoose = require('mongoose');

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

jest.mock('../models/userProfile', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/ownerMessageLog', () => ({
  create: jest.fn(),
}));

const helper = require('../utilities/permissions');
const UserProfile = require('../models/userProfile');
const OwnerMessageLog = require('../models/ownerMessageLog');
const OwnerMessage = require('../models/ownerMessage');
const { mockReq, mockRes, assertResMock } = require('../test');
const ownerMessageController = require('./ownerMessageController');

const makeSut = () => {
  const { getOwnerMessage, updateOwnerMessage, deleteOwnerMessage } =
    ownerMessageController(OwnerMessage);
  return { getOwnerMessage, updateOwnerMessage, deleteOwnerMessage };
};

const flushPromises = () => new Promise(setImmediate);

describe('ownerMessageController Unit Tests', () => {
  let mockFind;
  let mockSave;
  let mockSession;

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockSave = jest.fn().mockResolvedValue({});

    mockSession = {
      startTransaction: jest.fn().mockResolvedValue(),
      commitTransaction: jest.fn().mockResolvedValue(),
      abortTransaction: jest.fn().mockResolvedValue(),
      endSession: jest.fn().mockResolvedValue(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

    UserProfile.findById.mockResolvedValue({
      email: 'test@test.com',
      firstName: 'John',
      lastName: 'Doe',
    });

    OwnerMessageLog.create.mockResolvedValue({});

    // Default mock supports .session() chaining — needed by update and delete
    mockFind = jest.spyOn(OwnerMessage, 'find').mockReturnValue({
      session: jest.fn().mockResolvedValue([]),
    });

    mockReq.body = {};
  });

  describe('getOwnerMessage', () => {
    test('Ensures getOwnerMessage returns status 404 if owner message cant be found', async () => {
      const { getOwnerMessage } = makeSut();
      const errorMsg = 'Error occurred when finding owner message';
      // getOwnerMessage uses find({}) with NO .session() — override with direct rejection
      mockFind.mockRejectedValue(errorMsg);
      const response = await getOwnerMessage(mockReq, mockRes);
      await flushPromises();
      assertResMock(404, errorMsg, response, mockRes);
    });

    test('Ensures getOwnerMessage returns status 200 with new owner message if none exist', async () => {
      // getOwnerMessage uses find({}) with NO .session() — override with direct resolution
      mockFind.mockResolvedValue([]);
      const ownerMessageInstance = new OwnerMessage();
      const mockSaveFn = jest.fn().mockResolvedValue(ownerMessageInstance);
      jest.spyOn(OwnerMessage.prototype, 'save').mockImplementation(mockSaveFn);

      await makeSut().getOwnerMessage(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerMessage: expect.objectContaining({
            _id: expect.anything(),
            message: '',
            standardMessage: '',
          }),
        }),
      );
      expect(mockSaveFn).toHaveBeenCalled();
    });

    test('Ensures getOwnerMessage returns status 200 with the first owner message if it exists', async () => {
      const existingMessage = { message: 'Existing message', standardMessage: 'Standard message' };
      // getOwnerMessage uses find({}) with NO .session() — override with direct resolution
      mockFind.mockResolvedValue([existingMessage]);

      await makeSut().getOwnerMessage(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({ ownerMessage: existingMessage });
    });
  });

  describe('updateOwnerMessage', () => {
    test('Ensures updateOwnerMessage returns status 403 if requestor is not an owner', async () => {
      const { updateOwnerMessage } = makeSut();
      helper.hasPermission.mockResolvedValue(false);
      mockReq.body = { requestor: { role: 'User' } };
      const response = await updateOwnerMessage(mockReq, mockRes);
      await flushPromises();
      assertResMock(403, 'You are not authorized to create messages!', response, mockRes);
    });

    test('Ensures updateOwnerMessage returns status 201 and updates the owner message correctly with custom message', async () => {
      const existingMessage = { message: '', standardMessage: '', save: mockSave };
      // updateOwnerMessage uses find({}).session() — use .session() chaining mock
      mockFind.mockReturnValue({ session: jest.fn().mockResolvedValue([existingMessage]) });

      mockReq.body = {
        isStandard: false,
        newMessage: 'New custom message',
        requestor: { role: 'Owner', requestorId: 'requestorId123' },
      };
      helper.hasPermission.mockResolvedValue(true);

      await makeSut().updateOwnerMessage(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.send).toHaveBeenCalledWith({
        _serverMessage: 'Update successfully!',
        ownerMessage: { standardMessage: '', message: 'New custom message' },
      });
      expect(mockSave).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    test('Ensures updateOwnerMessage returns status 500 if an error occurs during the update', async () => {
      const errorMsg = 'Error occurred during update';
      // updateOwnerMessage uses find({}).session() — reject inside .session()
      mockFind.mockReturnValue({ session: jest.fn().mockRejectedValue(errorMsg) });
      mockReq.body = { requestor: { role: 'Owner' } };
      helper.hasPermission.mockResolvedValue(true);

      await makeSut().updateOwnerMessage(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(errorMsg);
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  describe('deleteOwnerMessage', () => {
    test('Ensures deleteOwnerMessage returns status 403 if requestor is not an owner', async () => {
      const { deleteOwnerMessage } = makeSut();
      mockReq.body = { requestor: { role: 'notOwner' } };
      helper.hasPermission.mockResolvedValue(false);
      const response = await deleteOwnerMessage(mockReq, mockRes);
      await flushPromises();
      assertResMock(403, 'You are not authorized to delete messages!', response, mockRes);
    });

    test('Ensures deleteOwnerMessage returns status 200 and deletes the owner message correctly', async () => {
      const existingMessage = {
        message: 'Existing message',
        standardMessage: 'Standard message',
        save: mockSave,
      };
      // deleteOwnerMessage uses find({}).session() — use .session() chaining mock
      mockFind.mockReturnValue({ session: jest.fn().mockResolvedValue([existingMessage]) });
      mockReq.body = { requestor: { role: 'Owner', requestorId: 'requestorId123' } };
      helper.hasPermission.mockResolvedValue(true);

      const { deleteOwnerMessage } = makeSut();
      await deleteOwnerMessage(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        _serverMessage: 'Delete successfully!',
        ownerMessage: existingMessage,
      });
      expect(mockSave).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    test('Ensures deleteOwnerMessage returns status 500 if an error occurs during the delete', async () => {
      const errorMsg = 'Error occurred during delete';
      // deleteOwnerMessage uses find({}).session() — reject inside .session()
      mockFind.mockReturnValue({ session: jest.fn().mockRejectedValue(errorMsg) });
      mockReq.body = { requestor: { role: 'Owner' } };
      helper.hasPermission.mockResolvedValue(true);

      const { deleteOwnerMessage } = makeSut();
      await deleteOwnerMessage(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(errorMsg);
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });
});