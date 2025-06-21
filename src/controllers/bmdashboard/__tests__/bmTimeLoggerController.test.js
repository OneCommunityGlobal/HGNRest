const bmTimeLoggerController = require('../bmTimeLoggerController');

// Mock the bmTimeLog model
const mockBmTimeLog = {
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  aggregate: jest.fn()
};

// Mock the BuildingProject model
const mockBuildingProject = {
  findOneAndUpdate: jest.fn()
};

// Mock mongoose
jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  Types: {
    ObjectId: jest.fn(() => 'mockId')
  }
}));

// Mock the models with correct paths
jest.mock('../../../models/bmdashboard/buildingProject', () => mockBuildingProject);
jest.mock('../../../models/task', () => ({}));

describe('bmTimeLoggerController', () => {
  let controller;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Initialize controller with mock model
    controller = bmTimeLoggerController(mockBmTimeLog);

    // Setup mock request and response
    mockReq = {
      params: {
        projectId: 'project123',
        memberId: 'member123'
      },
      body: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('startTimeLog', () => {
    it('should create a new time log when no existing log is found', async () => {
      mockBmTimeLog.findOne.mockResolvedValue(null);
      mockBmTimeLog.create.mockResolvedValue({
        _id: 'timelog123',
        project: 'project123',
        member: 'member123',
        status: 'ongoing',
        totalElapsedTime: 0,
        intervals: []
      });

      await controller.startTimeLog(mockReq, mockRes);

      expect(mockBmTimeLog.findOne).toHaveBeenCalledWith({
        project: 'project123',
        member: 'member123',
        status: { $in: ['ongoing', 'paused'] }
      });
      expect(mockBmTimeLog.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Time log started successfully'
      }));
    });

    it('should resume a paused time log', async () => {
      const pausedTimeLog = {
        _id: 'timelog123',
        status: 'paused',
        intervals: []
      };
      mockBmTimeLog.findOne.mockResolvedValue(pausedTimeLog);
      mockBmTimeLog.findByIdAndUpdate.mockResolvedValue({
        ...pausedTimeLog,
        status: 'ongoing'
      });

      await controller.startTimeLog(mockReq, mockRes);

      expect(mockBmTimeLog.findByIdAndUpdate).toHaveBeenCalledWith(
        'timelog123',
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'ongoing'
          })
        }),
        expect.any(Object)
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('pauseTimeLog', () => {
    it('should pause an ongoing time log', async () => {
      const ongoingTimeLog = {
        _id: 'timelog123',
        status: 'ongoing',
        currentIntervalStarted: new Date(Date.now() - 3600000), // 1 hour ago
        totalElapsedTime: 0,
        intervals: []
      };

      mockBmTimeLog.findOne.mockResolvedValue(ongoingTimeLog);
      mockBmTimeLog.findByIdAndUpdate.mockResolvedValue({
        ...ongoingTimeLog,
        status: 'paused'
      });

      mockReq.body.timeLogId = 'timelog123';

      await controller.pauseTimeLog(mockReq, mockRes);

      expect(mockBmTimeLog.findByIdAndUpdate).toHaveBeenCalledWith(
        'timelog123',
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'paused'
          })
        }),
        expect.any(Object)
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getProjectTimeLogs', () => {
    it('should return time logs for a project', async () => {
      const mockTimeLogs = [
        {
          _id: 'timelog123',
          project: 'project123',
          member: {
            firstName: 'John',
            lastName: 'Doe'
          },
          intervals: [],
          status: 'completed',
          totalElapsedTime: 3600000
        }
      ];

      mockBmTimeLog.aggregate.mockResolvedValue(mockTimeLogs);

      await controller.getProjectTimeLogs(mockReq, mockRes);

      expect(mockBmTimeLog.aggregate).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockTimeLogs);
    });

    it('should return time logs for a specific member', async () => {
      const mockTimeLogs = [
        {
          _id: 'timelog123',
          project: 'project123',
          member: {
            firstName: 'John',
            lastName: 'Doe'
          },
          intervals: [],
          status: 'completed',
          totalElapsedTime: 3600000
        }
      ];

      mockBmTimeLog.aggregate.mockResolvedValue(mockTimeLogs);

      await controller.getProjectTimeLogs(mockReq, mockRes);

      expect(mockBmTimeLog.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              project: 'project123',
              member: 'member123'
            })
          })
        ])
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});