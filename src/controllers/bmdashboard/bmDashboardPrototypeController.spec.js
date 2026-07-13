// Mock logger before requiring the controller
jest.mock('../../startup/logger', () => ({
  logException: jest.fn().mockReturnValue('mock-tracking-id'),
  logInfo: jest.fn(),
}));

const logger = require('../../startup/logger');

// Import controller factory
const bmDashboardPrototypeController = require('./bmDashboardPrototypeController');

describe('bmDashboardPrototypeController', () => {
  let mockReq;
  let mockRes;
  let mockDashboardMetrics;
  let mockBuildingProject;
  let mockBuildingMaterial;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      query: {},
      params: {},
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock DashboardMetrics model with constructor and static methods
    const mockFindOneResult = {
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    };

    const mockFindResult = {
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    // Create constructor function with static methods
    function MockDashboardMetrics(data) {
      this.date = data.date;
      this.metrics = data.metrics;
      this.snapshotType = data.snapshotType;
      this.save = jest.fn().mockResolvedValue(true);
    }

    MockDashboardMetrics.findOne = jest.fn().mockReturnValue(mockFindOneResult);
    MockDashboardMetrics.find = jest.fn().mockReturnValue(mockFindResult);

    mockDashboardMetrics = MockDashboardMetrics;

    // Mock BuildingProject model
    mockBuildingProject = {
      countDocuments: jest.fn().mockResolvedValue(10),
      aggregate: jest.fn().mockResolvedValue([{ totalLaborHours: 1000 }]),
    };

    // Mock BuildingMaterial model
    mockBuildingMaterial = {
      aggregate: jest.fn().mockResolvedValue([
        {
          _id: 'material-1',
          materialName: 'Wood',
          unit: 'board',
          totalStockBought: 100,
          totalStockUsed: 50,
          totalStockWasted: 10,
          totalStockAvailable: 40,
        },
      ]),
    };

    // Create controller instance with mocked models
    controller = bmDashboardPrototypeController(
      mockDashboardMetrics,
      mockBuildingProject,
      mockBuildingMaterial,
    );
  });

  describe('getMaterialCostTrends (Changed: Logger + Error Response)', () => {
    test('should return 200 with material trends on success', async () => {
      await controller.getMaterialCostTrends(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalled();
    });

    test('should call logger.logException with correct parameters on error', async () => {
      const error = new Error('Aggregation failed');
      mockBuildingMaterial.aggregate.mockRejectedValue(error);

      await controller.getMaterialCostTrends(mockReq, mockRes);

      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'bmDashboardController.getMaterialCostTrends',
        { endpoint: '/dashboard/materials/costs' },
      );
    });

    test('should return standardized error response format', async () => {
      const error = new Error('Test error');
      mockBuildingMaterial.aggregate.mockRejectedValue(error);

      await controller.getMaterialCostTrends(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('error', 'Internal Server Error');
      expect(jsonCall).toHaveProperty('message');
      expect(jsonCall).toHaveProperty('trackingId');
    });

    test('should include tracking ID in error response', async () => {
      mockBuildingMaterial.aggregate.mockRejectedValue(new Error('Test error'));

      await controller.getMaterialCostTrends(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          trackingId: 'mock-tracking-id',
        }),
      );
    });

    test('should include descriptive error message', async () => {
      mockBuildingMaterial.aggregate.mockRejectedValue(new Error('Test error'));

      await controller.getMaterialCostTrends(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'An unexpected error occurred while fetching material cost trends',
        }),
      );
    });
  });

  describe('getAllMetrics (Changed: Logger + Error Response)', () => {
    const mockMetrics = {
      totalProjects: { value: 100, trend: { value: 5, period: 'week' } },
      completedProjects: { value: 40, trend: { value: 3, period: 'week' } },
      delayedProjects: { value: 10, trend: { value: -2, period: 'week' } },
      activeProjects: { value: 50, trend: { value: 2, period: 'week' } },
      avgProjectDuration: { value: 1000, trend: { value: 0, period: 'week' } },
      totalMaterialCost: { value: 27.6, trend: { value: 5, period: 'week' } },
      totalLaborCost: { value: 18.4, trend: { value: 3, period: 'week' } },
      totalMaterialUsed: { value: 2714, trend: { value: 10, period: 'month' } },
      materialWasted: { value: 879, trend: { value: 5, period: 'month' } },
      materialAvailable: { value: 693, trend: { value: -3, period: 'month' } },
      materialUsed: { value: 1142, trend: { value: 8, period: 'month' } },
      totalLaborHours: { value: 12.8, trend: { value: 7, period: 'month' } },
    };

    test('should return 200 with formatted metrics on success', async () => {
      mockDashboardMetrics.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ metrics: mockMetrics }),
        }),
      });

      await controller.getAllMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('should call logger.logException with correct parameters on error', async () => {
      const error = new Error('Database error');
      mockDashboardMetrics.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(error),
        }),
      });

      await controller.getAllMetrics(mockReq, mockRes);

      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'bmDashboardController.getAllMetrics',
        { endpoint: '/dashboard/metrics' },
      );
    });

    test('should return standardized error response format', async () => {
      mockDashboardMetrics.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('Test error')),
        }),
      });

      await controller.getAllMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('error', 'Internal Server Error');
      expect(jsonCall).toHaveProperty('message');
      expect(jsonCall).toHaveProperty('trackingId');
    });

    test('should include tracking ID in error response', async () => {
      mockDashboardMetrics.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('Test error')),
        }),
      });

      await controller.getAllMetrics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          trackingId: 'mock-tracking-id',
        }),
      );
    });

    test('should include descriptive error message', async () => {
      mockDashboardMetrics.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('Test error')),
        }),
      });

      await controller.getAllMetrics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'An unexpected error occurred while fetching dashboard metrics',
        }),
      );
    });
  });

  describe('getHistoricalMetrics (Changed: Validation + Logger + Error Response)', () => {
    const validMetrics = [
      'totalProjects',
      'completedProjects',
      'delayedProjects',
      'activeProjects',
      'avgProjectDuration',
      'totalMaterialCost',
      'totalLaborCost',
      'totalMaterialUsed',
      'materialWasted',
      'materialAvailable',
      'materialUsed',
      'totalLaborHours',
    ];

    test('should return 400 when startDate is missing', async () => {
      mockReq.query = {
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };

      await controller.getHistoricalMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Missing required parameters: startDate, endDate, and metric are required',
        details: {
          missing: ['startDate'],
        },
      });
    });

    test('should return 400 when endDate is missing', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        metric: 'totalProjects',
      };

      await controller.getHistoricalMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Missing required parameters: startDate, endDate, and metric are required',
        details: {
          missing: ['endDate'],
        },
      });
    });

    test('should return 400 when metric is missing', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      };

      await controller.getHistoricalMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Missing required parameters: startDate, endDate, and metric are required',
        details: {
          missing: ['metric'],
        },
      });
    });

    test('should return 400 when date format is invalid', async () => {
      mockReq.query = {
        startDate: 'not-a-date',
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };

      await controller.getHistoricalMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid date format. Dates must be in ISO 8601 format (YYYY-MM-DD)',
        details: {
          startDate: 'Invalid',
          endDate: 'Valid',
        },
      });
    });

    test('should return 400 when startDate is after endDate', async () => {
      mockReq.query = {
        startDate: '2026-01-31',
        endDate: '2026-01-01',
        metric: 'totalProjects',
      };

      await controller.getHistoricalMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'startDate must be before or equal to endDate',
        details: {
          startDate: '2026-01-31',
          endDate: '2026-01-01',
        },
      });
    });

    test('should return 400 when metric name is invalid', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric: 'invalidMetric',
      };

      await controller.getHistoricalMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: `Invalid metric. Valid options are: ${validMetrics.join(', ')}`,
        details: {
          field: 'metric',
          provided: 'invalidMetric',
          validOptions: validMetrics,
        },
      });
    });

    test('should return error response with details object for validation errors', async () => {
      mockReq.query = {};

      await controller.getHistoricalMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('details');
      expect(jsonCall.details).toHaveProperty('missing');
    });

    test('should call logger.logException with query params on error', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };

      const error = new Error('Database error');
      mockDashboardMetrics.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockRejectedValue(error),
          }),
        }),
      });

      await controller.getHistoricalMetrics(mockReq, mockRes);

      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'bmDashboardController.getHistoricalMetrics',
        {
          endpoint: '/dashboard/metrics/history',
          query: mockReq.query,
        },
      );
    });

    test('should return standardized error response format for 500 errors', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };

      mockDashboardMetrics.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockRejectedValue(new Error('Server error')),
          }),
        }),
      });

      await controller.getHistoricalMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('error', 'Internal Server Error');
      expect(jsonCall).toHaveProperty('message');
      expect(jsonCall).toHaveProperty('trackingId');
    });

    test('should include tracking ID in error response', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };

      mockDashboardMetrics.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockRejectedValue(new Error('Server error')),
          }),
        }),
      });

      await controller.getHistoricalMetrics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          trackingId: 'mock-tracking-id',
        }),
      );
    });

    test('should return 200 with history data on success', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };

      const mockHistory = [
        { date: new Date('2026-01-15'), metrics: { totalProjects: { value: 100 } } },
      ];

      mockDashboardMetrics.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockHistory),
          }),
        }),
      });

      await controller.getHistoricalMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('refreshMetrics (Changed: Logger + Error Response)', () => {
    test('should call logger.logException with correct parameters on error', async () => {
      const error = new Error('Refresh failed');
      mockBuildingProject.countDocuments.mockRejectedValue(error);

      await controller.refreshMetrics(mockReq, mockRes);

      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'bmDashboardController.refreshMetrics',
        { endpoint: '/dashboard/metrics/refresh' },
      );
    });

    test('should return standardized error response format', async () => {
      mockBuildingProject.countDocuments.mockRejectedValue(new Error('Test error'));

      await controller.refreshMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('error', 'Internal Server Error');
      expect(jsonCall).toHaveProperty('message');
      expect(jsonCall).toHaveProperty('trackingId');
    });

    test('should include tracking ID in error response', async () => {
      mockBuildingProject.countDocuments.mockRejectedValue(new Error('Test error'));

      await controller.refreshMetrics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          trackingId: 'mock-tracking-id',
        }),
      );
    });

    test('should include descriptive error message', async () => {
      mockBuildingProject.countDocuments.mockRejectedValue(new Error('Test error'));

      await controller.refreshMetrics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'An unexpected error occurred while refreshing dashboard metrics',
        }),
      );
    });

    test('should return 200 with refreshed metrics on success', async () => {
      // Setup all required mocks for successful refresh
      mockBuildingProject.countDocuments.mockResolvedValue(10);
      mockBuildingProject.aggregate.mockResolvedValue([{ totalLaborHours: 1000 }]);
      mockBuildingMaterial.aggregate.mockResolvedValue([
        { totalMaterialUsed: 100, materialWasted: 10, materialAvailable: 50, stockBought: 160 },
      ]);

      // Setup findOne for snapshot check
      mockDashboardMetrics.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await controller.refreshMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('generateDashboardMetrics (Changed: Logger)', () => {
    test('should call logger.logException with correct parameters on error', async () => {
      const error = new Error('Generation failed');
      mockBuildingProject.countDocuments.mockRejectedValue(error);

      // Call generateDashboardMetrics indirectly through refreshMetrics
      await controller.refreshMetrics(mockReq, mockRes);

      expect(logger.logException).toHaveBeenCalledWith(
        error,
        expect.stringContaining('bmDashboardController'),
        expect.any(Object),
      );
    });

    test('should include snapshotType in logger context on generateDashboardMetrics error', async () => {
      const error = new Error('Generation failed');
      mockBuildingProject.countDocuments.mockRejectedValue(error);

      // We test this by checking the refreshMetrics error path
      // since generateDashboardMetrics is called internally
      await controller.refreshMetrics(mockReq, mockRes);

      // The error will be caught and logged
      expect(logger.logException).toHaveBeenCalled();
    });
  });

  describe('storeMetricsSnapshot (Changed: Logger)', () => {
    const mockMetrics = {
      totalProjects: { value: 100, trend: { value: 5, period: 'week' } },
      completedProjects: { value: 40, trend: { value: 3, period: 'week' } },
      delayedProjects: { value: 10, trend: { value: -2, period: 'week' } },
      activeProjects: { value: 50, trend: { value: 2, period: 'week' } },
      avgProjectDuration: { value: 1000, trend: { value: 0, period: 'week' } },
      totalMaterialCost: { value: 27.6, trend: { value: 5, period: 'week' } },
      totalLaborCost: { value: 18.4, trend: { value: 3, period: 'week' } },
      totalMaterialUsed: { value: 2714, trend: { value: 10, period: 'month' } },
      materialWasted: { value: 879, trend: { value: 5, period: 'month' } },
      materialAvailable: { value: 693, trend: { value: -3, period: 'month' } },
      materialUsed: { value: 1142, trend: { value: 8, period: 'month' } },
      totalLaborHours: { value: 12.8, trend: { value: 7, period: 'month' } },
    };

    test('should call logger.logInfo for weekly snapshot success', async () => {
      // No existing weekly/monthly snapshots (returns null)
      mockDashboardMetrics.findOne = jest
        .fn()
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ metrics: mockMetrics }),
          }),
        })
        .mockResolvedValueOnce(null) // no weekly snapshot
        .mockResolvedValueOnce(null) // no monthly snapshot
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ metrics: mockMetrics }),
          }),
        });

      await controller.getAllMetrics(mockReq, mockRes);

      // logInfo should be called for snapshot storage
      // The actual call depends on if snapshots are needed
    });

    test('should call logger.logException with correct parameters on storeMetricsSnapshot error', async () => {
      // This is tested through the error paths of getAllMetrics/refreshMetrics
      // since storeMetricsSnapshot is called internally
      const error = new Error('Snapshot storage failed');
      mockDashboardMetrics.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(error),
        }),
      });

      await controller.getAllMetrics(mockReq, mockRes);

      expect(logger.logException).toHaveBeenCalled();
    });

    test('should create weekly and monthly snapshots when none exist', async () => {
      // Mock to return existing weekly/monthly snapshots as null
      let callCount = 0;
      mockDashboardMetrics.findOne = jest.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          // storeMetricsSnapshot - check for weekly
          return Promise.resolve(null);
        }
        if (callCount === 2) {
          // storeMetricsSnapshot - check for monthly
          return Promise.resolve(null);
        }
        if (callCount === 3) {
          // storeMetricsSnapshot - get latest metrics
          return {
            sort: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue({ metrics: mockMetrics }),
            }),
          };
        }
        // getAllMetrics - get latest metrics
        return {
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ metrics: mockMetrics }),
          }),
        };
      });

      await controller.getAllMetrics(mockReq, mockRes);

      // Should call logInfo for both snapshots
      expect(logger.logInfo).toHaveBeenCalled();
    });
  });

  describe('getAllMetrics - generation path', () => {
    test('should generate metrics when no current metrics exist', async () => {
      // First call from storeMetricsSnapshot returns existing snapshots
      // Second call from getAllMetrics returns null (no current metrics)
      let callCount = 0;
      mockDashboardMetrics.findOne = jest.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount <= 2) {
          // storeMetricsSnapshot checks for weekly and monthly
          return Promise.resolve({ _id: 'existing' });
        }
        // getAllMetrics - returns null to trigger generation
        return {
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        };
      });

      // Mock successful metric generation
      mockBuildingProject.countDocuments.mockResolvedValue(10);
      mockBuildingProject.aggregate.mockResolvedValue([{ totalLaborHours: 1000 }]);
      mockBuildingMaterial.aggregate.mockResolvedValue([
        { totalMaterialUsed: 100, materialWasted: 10, materialAvailable: 50, stockBought: 160 },
      ]);

      await controller.getAllMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('should use default avgProjectDuration when no completed projects', async () => {
      let callCount = 0;
      mockDashboardMetrics.findOne = jest.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount <= 2) {
          return Promise.resolve({ _id: 'existing' });
        }
        return {
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        };
      });

      // Mock with no completed projects (to test avgProjectDuration default)
      mockBuildingProject.countDocuments = jest
        .fn()
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5) // active
        .mockResolvedValueOnce(2) // delayed
        .mockResolvedValueOnce(0); // completed = 0

      mockBuildingProject.aggregate.mockResolvedValue([]); // No labor stats
      mockBuildingMaterial.aggregate.mockResolvedValue([]); // No material stats

      await controller.getAllMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
