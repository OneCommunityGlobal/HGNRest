// Mock the FormResponse model
jest.mock('../models/hgnFormResponse');
jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const FormResponse = require('../models/hgnFormResponse');
const hgnFormController = require('./hgnFormResponseController');
const { hasPermission } = require('../utilities/permissions');

describe('HgnFormResponseController', () => {
  let mockReq;
  let mockRes;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      params: {},
      body: { requestor: { id: 'tester123' } },
      query: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    controller = hgnFormController();
    hasPermission.mockResolvedValue(true);
  });

  describe('submitFormResponse', () => {
    it('should create a new form response when all fields are provided', async () => {
      mockReq.body = {
        userInfo: { name: 'John' },
        general: {},
        frontend: {},
        backend: {},
        followUp: {},
        user_id: '123',
      };

      const saveMock = jest.fn().mockResolvedValue(true);
      FormResponse.mockImplementation(() => ({
        ...mockReq.body,
        save: saveMock,
      }));

      await controller.submitFormResponse(mockReq, mockRes);

      expect(saveMock).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          userInfo: { name: 'John' },
          general: {},
          frontend: {},
          backend: {},
          followUp: {},
          user_id: '123',
        }),
      );
    });

    it('should return 400 if any required field is missing', async () => {
      mockReq.body = { userInfo: {}, general: {} }; // missing fields

      await controller.submitFormResponse(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'All fields (userInfo, general, frontend, backend, followUp, user_id) are required',
      });
    });
  });

  describe('getAllFormResponses', () => {
    it('should return all form responses successfully', async () => {
      const mockResponses = [{ _id: '1' }, { _id: '2' }];
      FormResponse.find = jest.fn().mockResolvedValue(mockResponses);

      await controller.getAllFormResponses(mockReq, mockRes);

      expect(FormResponse.find).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockResponses);
    });

    it('should return 403 if user is not authorized', async () => {
      hasPermission.mockResolvedValue(false);

      await controller.getAllFormResponses(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not authorized' });
    });

    it('should handle database errors', async () => {
      const error = new Error('DB failed');
      FormResponse.find = jest.fn().mockRejectedValue(error);

      await controller.getAllFormResponses(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'DB failed' });
    });
  });

  describe('getRankedResponses', () => {
    it('should return ranked responses based on skills and preferences', async () => {
      mockReq.query = { skills: 'React,MongoDB', preferences: 'design' };

      const mockResponses = [
        {
          _id: '1',
          userInfo: { name: 'John', email: 'john@example.com', slack: 'john' },
          frontend: { React: '8' },
          backend: { MongoDB: '7' },
          general: {
            preferences: ['design'],
            combined_frontend_backend: '8',
            leadership_skills: '7',
            leadership_experience: '6',
            mern_skills: '7',
          },
        },
        {
          _id: '2',
          userInfo: { name: 'Jane', email: 'jane@example.com', slack: 'jane' },
          frontend: { React: '9' },
          backend: { MongoDB: '8' },
          general: {
            preferences: ['design', 'management'],
            combined_frontend_backend: '9',
            leadership_skills: '8',
            leadership_experience: '7',
            mern_skills: '8',
          },
        },
        {
          _id: '3',
          userInfo: { name: 'Alice', email: 'alice@example.com', slack: 'alice' },
          frontend: { Database: '9' },
          backend: { MongoDB: '8' },
          general: {
            preferences: ['backend', 'management'],
            combined_frontend_backend: '9',
            leadership_skills: '8',
            leadership_experience: '7',
            mern_skills: '8',
          },
        },
      ];

      FormResponse.find = jest.fn().mockResolvedValue(mockResponses);

      await controller.getRankedResponses(mockReq, mockRes);

      const result = mockRes.json.mock.calls[0][0];

      expect(FormResponse.find).toHaveBeenCalled();
      expect(result[0]._id).toBe('2'); // Jane should be ranked higher
      expect(result[0].topSkills).toEqual(expect.arrayContaining(['React']));
      expect(result[1]._id).toBe('1');
    });

    it('should return all users if no query params are provided', async () => {
      const mockResponses = [
        { _id: '1', userInfo: { name: 'A' }, frontend: {}, backend: {}, general: {} },
        { _id: '2', userInfo: { name: 'B' }, frontend: {}, backend: {}, general: {} },
      ];

      FormResponse.find = jest.fn().mockResolvedValue(mockResponses);

      await controller.getRankedResponses(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ _id: '1' }),
          expect.objectContaining({ _id: '2' }),
        ]),
      );
    });

    it('should handle database errors when ranking users', async () => {
      FormResponse.find = jest.fn().mockRejectedValue(new Error('DB fail'));

      await controller.getRankedResponses(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to rank users' });
    });
  });
});
