/* eslint-disable arrow-body-style */
// Mock the BuildingProject model
const mockAggregate = jest.fn();
const mockCostAggregate = jest.fn();
const mockFindById = jest.fn();

jest.mock('../../../models/bmdashboard/buildingProject', () => ({
  aggregate: mockAggregate,
  findById: mockFindById,
}));

jest.mock('../../../models/costs', () => ({
  aggregate: mockCostAggregate,
}));

// const mongoose = require('mongoose');
const BuildingProject = require('../../../models/bmdashboard/buildingProject');
const bmMProjectController = require('../bmProjectController');

describe('Building Manager Project Controller', () => {
  let req;
  let res;
  const controller = bmMProjectController(BuildingProject);

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockCostAggregate.mockResolvedValue([]);

    // Setup request and response objects
    req = {
      params: {},
      headers: {
        authorization: 'mock-token',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
  });

  describe('fetchAllProjects', () => {
    const mockProjects = [
      {
        _id: 'project1',
        name: 'Test Project 1',
        isActive: true,
        template: 'Earthbag Village',
        location: 'Location 1',
        dateCreated: new Date(),
        buildingManager: {
          _id: 'manager1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        teams: ['team1', 'team2'],
        members: [
          { user: 'user1', hours: 10 },
          { user: 'user2', hours: 15 },
        ],
        materials: [
          {
            _id: 'material1',
            name: 'Material 1',
            stockWasted: 10,
            stockAvailable: 50,
            stockBought: 100,
            itemType: { name: 'Type 1' },
          },
          {
            _id: 'material2',
            name: 'Material 2',
            stockWasted: 5,
            stockAvailable: 20,
            stockBought: 50,
            itemType: { name: 'Type 2' },
          },
        ],
        hoursWorked: 25,
        totalMaterialsCost: 1500,
        totalEquipmentCost: 3000,
      },
    ];

    it('should return a list of all active projects with additional calculated fields', async () => {
      mockAggregate.mockResolvedValue(mockProjects);

      // Call the controller function
      await controller.fetchAllProjects(req, res);

      // Verify the project data is processed by the controller
      expect(mockProjects[0]).toHaveProperty('mostMaterialWaste');
      expect(mockProjects[0]).toHaveProperty('leastMaterialAvailable');
      expect(mockProjects[0]).toHaveProperty('mostMaterialBought');

      // Assertions
      expect(BuildingProject.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalled();
    });

    it('uses only project-scoped cost records and leaves missing costs empty', async () => {
      const firstProjectId = '507f1f77bcf86cd799439011';
      const secondProjectId = '507f1f77bcf86cd799439012';
      mockAggregate.mockResolvedValue([
        { _id: firstProjectId, materials: [], members: [] },
        { _id: secondProjectId, materials: [], members: [] },
      ]);
      mockCostAggregate.mockResolvedValue([
        {
          _id: { projectId: firstProjectId, category: 'Total Cost of Materials' },
          amount: 125,
        },
      ]);

      await controller.fetchAllProjects(req, res);

      const [firstProject, secondProject] = res.send.mock.calls[0][0];
      expect(firstProject.totalMaterialsCost).toBe(125);
      expect(firstProject.totalEquipmentCost).toBeNull();
      expect(secondProject.totalMaterialsCost).toBeNull();
      expect(secondProject.totalEquipmentCost).toBeNull();
      expect(firstProject.rentalSummary).toBeNull();
      expect(secondProject.rentalSummary).toBeNull();
    });

    it('should handle errors in the aggregation pipeline', async () => {
      // Setup mock error
      const mockError = new Error('Database error');

      mockAggregate.mockRejectedValue(mockError);

      // Call the controller function
      await controller.fetchAllProjects(req, res);

      // Assertions
      expect(BuildingProject.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(mockError);
    });

    it('should handle errors thrown during execution', async () => {
      // Setup a thrown error
      const mockError = new Error('Unexpected error');
      mockAggregate.mockRejectedValue(mockError);

      // Call the controller function
      await controller.fetchAllProjects(req, res);

      // Assertions
      expect(BuildingProject.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(mockError);
    });
  });

  describe('fetchSingleProject', () => {
    const mockProject = {
      _id: 'project1',
      name: 'Test Project 1',
      isActive: true,
      template: 'Earthbag Village',
      location: 'Location 1',
      dateCreated: new Date(),
      buildingManager: {
        _id: 'manager1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      },
      teams: ['team1', 'team2'],
      members: [
        { user: 'user1', hours: 10 },
        { user: 'user2', hours: 15 },
      ],
    };

    beforeEach(() => {
      req.params.projectId = 'project1';
    });

    it('should return a project by its ID', async () => {
      // Mock the complete chain required by the controller
      // The controller uses: findById().populate().exec().then().catch()

      const catchMock = jest.fn();
      const thenMock = jest.fn((callback) => {
        callback(mockProject);
        return { catch: catchMock };
      });

      const execMock = jest.fn(() => ({
        then: thenMock,
      }));

      const populateMock = jest.fn(() => ({
        exec: execMock,
      }));

      mockFindById.mockReturnValue({
        populate: populateMock,
      });

      // Call the controller function
      await controller.fetchSingleProject(req, res);

      // Assertions
      expect(BuildingProject.findById).toHaveBeenCalledWith('project1');
      expect(populateMock).toHaveBeenCalled();
      expect(execMock).toHaveBeenCalled();
      expect(thenMock).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockProject);
    });

    it('should handle errors when fetching a project', async () => {
      // Setup mock error
      const mockError = new Error('Project not found');

      // Mock the complete chain with error
      const catchMock = jest.fn((errorCallback) => {
        errorCallback(mockError);
      });

      const thenMock = jest.fn(() => ({ catch: catchMock }));

      const execMock = jest.fn(() => ({ then: thenMock }));

      const populateMock = jest.fn(() => ({ exec: execMock }));

      mockFindById.mockReturnValue({
        populate: populateMock,
      });

      // Call the controller function
      await controller.fetchSingleProject(req, res);

      // Assertions
      expect(BuildingProject.findById).toHaveBeenCalledWith('project1');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(mockError);
    });

    it('should handle errors thrown during execution', async () => {
      // Setup a thrown error
      const mockError = new Error('Unexpected error');
      mockFindById.mockImplementation(() => {
        throw mockError;
      });

      // Call the controller function
      await controller.fetchSingleProject(req, res);

      // Assertions
      expect(BuildingProject.findById).toHaveBeenCalledWith('project1');
      expect(res.json).toHaveBeenCalledWith(mockError);
    });
  });
});
