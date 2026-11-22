/* eslint-disable arrow-body-style */
// Mock the BuildingProject model
const mockAggregate = jest.fn();
const mockCostAggregate = jest.fn();
const mockFindById = jest.fn();
const mockFind = jest.fn();

jest.mock('../../../models/bmdashboard/buildingProject', () => ({
  aggregate: mockAggregate,
  findById: mockFindById,
  find: mockFind,
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

  describe('fetchProjectsWithLocation', () => {
    const project = {
      _id: 'project1',
      name: 'Test Project 1',
      city: 'San Diego',
      country: 'United States',
      latitude: 32.7157,
      longitude: -117.1611,
      status: 'active',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    };

    const configureFind = (projects) => {
      const lean = jest.fn().mockResolvedValue(projects);
      const select = jest.fn().mockReturnValue({ lean });
      mockFind.mockReturnValue({ select });
      return { lean, select };
    };

    it('returns location projects using validated filters', async () => {
      const { select } = configureFind([project]);
      req.query = {
        status: 'Active',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      };

      await controller.fetchProjectsWithLocation(req, res);

      expect(mockFind).toHaveBeenCalledWith({
        latitude: { $type: 'number' },
        longitude: { $type: 'number' },
        status: 'active',
        startDate: {
          $gte: new Date('2026-01-01'),
          $lte: new Date('2026-12-31'),
        },
      });
      expect(select).toHaveBeenCalledWith(
        '_id name address city country latitude longitude status startDate endDate',
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: [expect.objectContaining({ orgId: 'project1', name: 'Test Project 1' })],
      });
    });

    it('rejects an invalid status before querying', async () => {
      req.query = { status: { $ne: 'active' } };

      await controller.fetchProjectsWithLocation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid project status' });
      expect(mockFind).not.toHaveBeenCalled();
    });

    it.each([
      [{ startDate: 'not-a-date' }, 'Dates must be valid ISO dates'],
      [{ startDate: '2026-02-01', endDate: '2026-01-01' }, 'End date cannot be before start date'],
    ])('rejects invalid date filters', async (query, message) => {
      req.query = query;

      await controller.fetchProjectsWithLocation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message });
      expect(mockFind).not.toHaveBeenCalled();
    });

    it('returns a server error when the location query fails', async () => {
      mockFind.mockImplementation(() => {
        throw new Error('Database error');
      });

      await controller.fetchProjectsWithLocation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to retrieve projects with location',
      });
    });
  });
});
