const FormResponse = require('../models/hgnFormResponse');
const hgnFormController = require('./hgnFormResponseController');

// Mock the FormResponse model
jest.mock('../models/hgnFormResponse');

describe('HgnFormResponseController', () => {
  let mockReq;
  let mockRes;
  let controller;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock request
    mockReq = {
      body: {},
      params: {},
      query: {}
    };

    // Setup mock response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Initialize controller
    controller = hgnFormController();
  });

  describe('submitFormResponse', () => {
    

    
  });

  describe('getAllFormResponses', () => {
    it('should return all form responses successfully', async () => {
      // Arrange
      const mockResponses = [
        {
          _id: '507f1f77bcf86cd799439011',
          userInfo: { name: 'John Doe', email: 'john@example.com' },
          general: { hours: '10-20' },
          frontend: { overall: '8' },
          backend: { overall: '7' },
          followUp: { platform: 'Windows' },
          user_id: '507f1f77bcf86cd799439011'
        },
        {
          _id: '507f1f77bcf86cd799439012',
          userInfo: { name: 'Jane Smith', email: 'jane@example.com' },
          general: { hours: '20-30' },
          frontend: { overall: '9' },
          backend: { overall: '8' },
          followUp: { platform: 'macOS' },
          user_id: '507f1f77bcf86cd799439012'
        }
      ];

      FormResponse.find = jest.fn().mockResolvedValue(mockResponses);

      // Act
      await controller.getAllFormResponses(mockReq, mockRes);

      // Assert
      expect(FormResponse.find).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockResponses);
    });

    it('should handle database errors when fetching form responses', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      FormResponse.find = jest.fn().mockRejectedValue(error);

      // Act
      await controller.getAllFormResponses(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Database connection failed'
      });
    });
  });

  describe('getRankedResponses', () => {
    it('should return ranked responses based on specified skills', async () => {
      // Arrange
      const skills = 'React,MongoDB';
      mockReq.query = { skills };

      const mockResponses = [
        {
          _id: '507f1f77bcf86cd799439011',
          userInfo: { name: 'John Doe', email: 'john@example.com', slack: 'john_doe' },
          frontend: { React: '8' },
          backend: { MongoDB: '7' }
        },
        {
          _id: '507f1f77bcf86cd799439012',
          userInfo: { name: 'Jane Smith', email: 'jane@example.com', slack: 'jane_smith' },
          frontend: { React: '9' },
          backend: { MongoDB: '8' }
        }
      ];

      FormResponse.find = jest.fn().mockResolvedValue(mockResponses);

      // Act
      await controller.getRankedResponses(mockReq, mockRes);

      // Assert
      expect(FormResponse.find).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith([
        {
          _id: '507f1f77bcf86cd799439012',
          name: 'Jane Smith',
          email: 'jane@example.com',
          slack: 'jane_smith',
          score: 8.5,
          topSkills: ['React', 'MongoDB'],
          isTeammate: false,
          privacy: { email: false, slack: false }
        },
        {
          _id: '507f1f77bcf86cd799439011',
          name: 'John Doe',
          email: 'john@example.com',
          slack: 'john_doe',
          score: 7.5,
          topSkills: ['React', 'MongoDB'],
          isTeammate: false,
          privacy: { email: false, slack: false }
        }
      ]);
    });

    it('should return 400 error when skills query parameter is missing', async () => {
      // Arrange
      mockReq.query = {};

      // Act
      await controller.getRankedResponses(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing skills query'
      });
      expect(FormResponse.find).not.toHaveBeenCalled();
    });

    it('should handle database errors when calculating ranked responses', async () => {
      // Arrange
      const skills = 'React,MongoDB';
      mockReq.query = { skills };

      const error = new Error('Database connection failed');
      FormResponse.find = jest.fn().mockRejectedValue(error);

      // Act
      await controller.getRankedResponses(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to calculate ranked responses'
      });
    });
  });
});
