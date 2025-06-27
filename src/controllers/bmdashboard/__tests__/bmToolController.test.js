const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bmToolController = require('../bmToolController');

// Mocks
jest.mock('mongoose');

describe('Building Tool Controller Tests', () => {
  let mockBuildingTool;
  let mockToolType;
  let controller;
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock models
    mockBuildingTool = {
      find: jest.fn().mockReturnThis(),
      findById: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      findOneAndUpdate: jest.fn().mockReturnThis(),
      create: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation((callback) => {
        callback([]);
        return { catch: jest.fn() };
      }),
      catch: jest.fn(),
    };

    mockToolType = {
      findOne: jest.fn().mockResolvedValue({
        available: ['tool1', 'tool2'],
        using: ['tool3'],
        save: jest.fn().mockResolvedValue(true),
      }),
    };

    // Create controller with mock models
    controller = bmToolController(mockBuildingTool, mockToolType);

    // Mock request and response
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('fetchAllTools', () => {
    beforeEach(() => {
      mockRequest = {};
    });

    test('should return 200 and results when successful', async () => {
      // Mock data
      const mockTools = [{ _id: '123', name: 'Hammer' }];

      // Setup the successful response
      mockBuildingTool.then = jest.fn().mockImplementation((callback) => {
        callback(mockTools);
        return { catch: jest.fn() };
      });

      // Call the controller method
      await controller.fetchAllTools(mockRequest, mockResponse);

      // Assertions
      expect(mockBuildingTool.find).toHaveBeenCalled();
      expect(mockBuildingTool.populate).toHaveBeenCalledWith(expect.any(Array));
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith(mockTools);
    });

    test('should return 500 when an error occurs', async () => {
      // Setup error response
      const mockError = new Error('Database error');
      mockBuildingTool.exec = jest.fn().mockReturnValue({
        then: jest.fn().mockReturnValue({
          catch: jest.fn().mockImplementation((callback) => {
            callback(mockError);
          }),
        }),
      });

      // Call the controller method
      await controller.fetchAllTools(mockRequest, mockResponse);

      // Assertions
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        message: `Error occurred while fetching tools: ${mockError.message}`,
      });
    });
  });

  describe('fetchSingleTool', () => {
    beforeEach(() => {
      mockRequest = { params: { toolId: '123abc' } };
    });

    test('should return 200 and tool when successful', async () => {
      // Mock data
      const mockTool = { _id: '123abc', name: 'Hammer' };

      // Setup successful response
      mockBuildingTool.then = jest.fn().mockImplementation((callback) => {
        callback(mockTool);
        return { catch: jest.fn() };
      });

      // Call the controller method
      await controller.fetchSingleTool(mockRequest, mockResponse);

      // Assertions
      expect(mockBuildingTool.findById).toHaveBeenCalledWith('123abc');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith(mockTool);
    });

    test('should return 500 when an error occurs', async () => {
      // Setup error response
      const mockError = new Error('Database error');
      mockBuildingTool.exec = jest.fn().mockReturnValue({
        then: jest.fn().mockReturnValue({
          catch: jest.fn().mockImplementation((callback) => {
            callback(mockError);
          }),
        }),
      });

      // Call the controller method
      await controller.fetchSingleTool(mockRequest, mockResponse);

      // Assertions
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(mockError);
    });

    test('should handle unexpected errors', async () => {
      // Make findById throw an error
      mockBuildingTool.findById = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Call the controller method
      await controller.fetchSingleTool(mockRequest, mockResponse);

      // Assertions
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  describe('bmPurchaseTools', () => {
    beforeEach(() => {
      mockRequest = {
        body: {
          projectId: 'project123',
          toolId: 'tool123',
          quantity: 5,
          priority: 'High',
          estTime: '2 weeks',
          desc: 'For construction project',
          makeModel: 'Model XYZ',
          requestor: {
            requestorId: 'user123',
          },
        },
      };

      // Reset mongoose mock
      mongoose.Types.ObjectId = jest.fn((id) => id);
    });

    test('should create a new tool document when none exists', async () => {
      // Setup for no existing document
      mockBuildingTool.findOne = jest.fn().mockResolvedValue(null);
      mockBuildingTool.create = jest.fn().mockImplementation(() => {
        return {
          then: jest.fn().mockImplementation((callback) => {
            callback();
            return { catch: jest.fn() };
          }),
        };
      });

      // Call the controller method
      await controller.bmPurchaseTools(mockRequest, mockResponse);

      // Assertions
      expect(mockBuildingTool.findOne).toHaveBeenCalledWith({
        project: 'project123',
        itemType: 'tool123',
      });

      expect(mockBuildingTool.create).toHaveBeenCalledWith(
        expect.objectContaining({
          itemType: 'tool123',
          project: 'project123',
          purchaseRecord: [expect.any(Object)],
        }),
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    test('should update existing tool document when one exists', async () => {
      // Setup for existing document
      mockBuildingTool.findOne = jest.fn().mockResolvedValue({ _id: 'existingTool123' });
      mockBuildingTool.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockReturnValue({
          then: jest.fn().mockImplementation((callback) => {
            callback();
            return { catch: jest.fn() };
          }),
        }),
      });

      // Call the controller method
      await controller.bmPurchaseTools(mockRequest, mockResponse);

      // Assertions
      expect(mockBuildingTool.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'existingTool123' },
        { $push: { purchaseRecord: expect.any(Object) } },
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    test('should handle errors', async () => {
      // Setup error
      mockBuildingTool.findOne = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      // Call the controller method
      await controller.bmPurchaseTools(mockRequest, mockResponse);

      // Assertions
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('bmLogTools', () => {
    beforeEach(() => {
      // Setup mock request for checking out tools
      mockRequest = {
        body: {
          requestor: { requestorId: 'user123' },
          typesArray: [
            {
              toolName: 'Hammer',
              toolType: 'type123',
              toolCodes: [{ value: 'tool1', label: 'Hammer-001' }],
              toolItems: ['tool1'],
            },
          ],
          action: 'Check Out',
          date: '2023-01-01',
        },
      };

      // Setup building tool document mock
      const mockBuildingToolDoc = {
        logRecord: [],
        userResponsible: 'user456',
        save: jest.fn().mockResolvedValue(true),
      };

      // Setup for findOne to return a mock document
      mongoose.Types.ObjectId = jest.fn((id) => id);
      mockBuildingTool.findOne = jest.fn().mockResolvedValue(mockBuildingToolDoc);
    });

    test('should return 500 when no tools are selected', async () => {
      // Override request with empty typesArray
      mockRequest.body.typesArray = [];

      // Call the controller method
      await controller.bmLogTools(mockRequest, mockResponse);

      // Assertions
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        errors: [{ message: 'Invalid request. No tools selected' }],
        results: [],
      });
    });

    test('should log a successful checkout', async () => {
      // Call the controller method
      await controller.bmLogTools(mockRequest, mockResponse);

      // Assertions
      expect(mockToolType.findOne).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith({
        errors: [],
        results: [{ message: 'Check Out successful for Hammer Hammer-001' }],
      });
    });

    test('should handle errors when tool type is not found', async () => {
      // Setup to return null for tool type
      mockToolType.findOne = jest.fn().mockResolvedValue(null);

      // Call the controller method
      await controller.bmLogTools(mockRequest, mockResponse);

      // Assertions
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith({
        errors: [{ message: expect.stringContaining('was not found') }],
        results: [],
      });
    });

    test('should handle errors when building tool is not found', async () => {
      // Setup to return null for building tool
      mockBuildingTool.findOne = jest.fn().mockResolvedValue(null);

      // Call the controller method
      await controller.bmLogTools(mockRequest, mockResponse);

      // Assertions
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith({
        errors: [{ message: expect.stringContaining('was not found') }],
        results: [],
      });
    });

    test('should handle check in operations', async () => {
      // Update request to check in
      mockRequest.body.action = 'Check In';

      // Set up the mock ToolType document to have the tool in "using" array
      mockToolType.findOne = jest.fn().mockResolvedValue({
        available: ['tool2'],
        using: ['tool1', 'tool3'], // Make sure tool1 is in the "using" array
        save: jest.fn().mockResolvedValue(true),
      });

      // Call the controller method
      await controller.bmLogTools(mockRequest, mockResponse);

      // Assertions
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith({
        errors: [],
        results: [{ message: 'Check In successful for Hammer Hammer-001' }],
      });
    });

    test('should handle check in errors when tool is not in use', async () => {
      // Update request to check in
      mockRequest.body.action = 'Check In';

      // Set up the mock ToolType document where the tool is NOT in "using" array
      mockToolType.findOne = jest.fn().mockResolvedValue({
        available: ['tool1', 'tool2'], // tool1 is already in available, not in using
        using: ['tool3'],
        save: jest.fn().mockResolvedValue(true),
      });

      // Call the controller method
      await controller.bmLogTools(mockRequest, mockResponse);

      // Assertions
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith({
        errors: [{ message: expect.stringContaining('is not available for Check In') }],
        results: [],
      });
    });
  });
});
