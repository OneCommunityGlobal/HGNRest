// Mock dependencies before requiring the controller
jest.mock('../services/summaryDashboard.service');
jest.mock('../startup/logger', () => ({
  logException: jest.fn().mockReturnValue('mock-tracking-id'),
  logInfo: jest.fn(),
}));

const service = require('../services/summaryDashboard.service');
const logger = require('../startup/logger');

// Import controller after mocks are set up
const controller = require('./summaryDashboard.controller');

describe('summaryDashboard.controller', () => {
  let mockReq;
  let mockRes;

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
  });

  describe('getMetrics', () => {
    const mockMetricsResponse = {
      _id: 'mock-id',
      date: new Date('2026-01-23'),
      snapshotType: 'current',
      metrics: {
        totalProjects: 100,
        completedProjects: 40,
        delayedProjects: 10,
        activeProjects: 50,
        avgProjectDuration: 1000,
        totalMaterialCost: 27.6,
        totalLaborCost: 18.4,
        totalMaterialUsed: 2714,
        materialWasted: 879,
        materialAvailable: 693,
        materialUsed: 1142,
        totalLaborHours: 12.8,
      },
    };

    test('should return 200 with flattened metrics on success', async () => {
      service.getAllMetrics.mockResolvedValue(mockMetricsResponse);

      await controller.getMetrics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(mockMetricsResponse);
      expect(service.getAllMetrics).toHaveBeenCalled();
    });

    test('should return 500 with tracking ID when service returns null', async () => {
      service.getAllMetrics.mockResolvedValue(null);

      await controller.getMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve metrics',
        message: 'Unable to generate or retrieve dashboard metrics',
        trackingId: 'mock-tracking-id',
      });
    });

    test('should return 500 with tracking ID when service throws error', async () => {
      const error = new Error('Service error');
      service.getAllMetrics.mockRejectedValue(error);

      await controller.getMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while fetching dashboard metrics',
        trackingId: 'mock-tracking-id',
      });
    });

    test('should call logger.logException with correct parameters on error', async () => {
      const error = new Error('Service error');
      service.getAllMetrics.mockRejectedValue(error);

      await controller.getMetrics(mockReq, mockRes);

      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'summaryDashboardController.getMetrics',
        { endpoint: '/metrics' },
      );
    });

    test('should return correct error response format', async () => {
      service.getAllMetrics.mockRejectedValue(new Error('Test error'));

      await controller.getMetrics(mockReq, mockRes);

      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('error');
      expect(jsonCall).toHaveProperty('message');
      expect(jsonCall).toHaveProperty('trackingId');
    });
  });

  describe('getMaterialCosts', () => {
    const mockTrendsResponse = [
      { date: new Date('2026-01-01'), cost: 25.5 },
      { date: new Date('2026-01-15'), cost: 27.6 },
    ];

    test('should return 200 with material cost trends on success', async () => {
      service.getMaterialCostTrends.mockResolvedValue(mockTrendsResponse);

      await controller.getMaterialCosts(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(mockTrendsResponse);
      expect(service.getMaterialCostTrends).toHaveBeenCalled();
    });

    test('should return 500 with tracking ID when service throws error', async () => {
      const error = new Error('Service error');
      service.getMaterialCostTrends.mockRejectedValue(error);

      await controller.getMaterialCosts(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while fetching material cost trends',
        trackingId: 'mock-tracking-id',
      });
    });

    test('should call logger.logException with correct parameters on error', async () => {
      const error = new Error('Service error');
      service.getMaterialCostTrends.mockRejectedValue(error);

      await controller.getMaterialCosts(mockReq, mockRes);

      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'summaryDashboardController.getMaterialCosts',
        { endpoint: '/materials/costs' },
      );
    });

    test('should return correct error response format', async () => {
      service.getMaterialCostTrends.mockRejectedValue(new Error('Test error'));

      await controller.getMaterialCosts(mockReq, mockRes);

      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('error');
      expect(jsonCall).toHaveProperty('message');
      expect(jsonCall).toHaveProperty('trackingId');
    });
  });

  describe('getHistory', () => {
    const mockHistoryResponse = [
      { date: new Date('2026-01-01'), value: 95 },
      { date: new Date('2026-01-15'), value: 100 },
    ];

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

    test('should return 200 with history data on success', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };
      service.getHistory.mockResolvedValue(mockHistoryResponse);

      await controller.getHistory(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(mockHistoryResponse);
      expect(service.getHistory).toHaveBeenCalledWith('2026-01-01', '2026-01-31', 'totalProjects');
    });

    test('should return 400 when startDate is missing', async () => {
      mockReq.query = {
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };

      await controller.getHistory(mockReq, mockRes);

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

      await controller.getHistory(mockReq, mockRes);

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

      await controller.getHistory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Missing required parameters: startDate, endDate, and metric are required',
        details: {
          missing: ['metric'],
        },
      });
    });

    test('should return 400 when multiple parameters are missing', async () => {
      mockReq.query = {};

      await controller.getHistory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Missing required parameters: startDate, endDate, and metric are required',
        details: {
          missing: ['startDate', 'endDate', 'metric'],
        },
      });
    });

    test('should return 400 when metric name is invalid', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric: 'invalidMetric',
      };

      await controller.getHistory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid metric name: invalidMetric',
        details: {
          field: 'metric',
          provided: 'invalidMetric',
          validOptions: validMetrics,
        },
      });
    });

    test('should return 400 when startDate format is invalid', async () => {
      mockReq.query = {
        startDate: 'not-a-date',
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };

      await controller.getHistory(mockReq, mockRes);

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

    test('should return 400 when endDate format is invalid', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: 'invalid-date',
        metric: 'totalProjects',
      };

      await controller.getHistory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid date format. Dates must be in ISO 8601 format (YYYY-MM-DD)',
        details: {
          startDate: 'Valid',
          endDate: 'Invalid',
        },
      });
    });

    test('should return 400 when startDate is after endDate', async () => {
      mockReq.query = {
        startDate: '2026-01-31',
        endDate: '2026-01-01',
        metric: 'totalProjects',
      };

      await controller.getHistory(mockReq, mockRes);

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

    test('should return 400 when service throws validation error', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };
      const validationError = new Error('Invalid date format');
      service.getHistory.mockRejectedValue(validationError);

      await controller.getHistory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid date format',
        trackingId: 'mock-tracking-id',
      });
    });

    test('should return 500 with tracking ID when service throws unexpected error', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };
      const error = new Error('Database connection failed');
      service.getHistory.mockRejectedValue(error);

      await controller.getHistory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while fetching metric history',
        trackingId: 'mock-tracking-id',
      });
    });

    test('should call logger.logException with query params on error', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };
      const error = new Error('Service error');
      service.getHistory.mockRejectedValue(error);

      await controller.getHistory(mockReq, mockRes);

      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'summaryDashboardController.getHistory',
        {
          endpoint: '/metrics/history',
          query: mockReq.query,
        },
      );
    });

    test.each([
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
    ])('should accept valid metric: %s', async (metric) => {
      service.getHistory.mockResolvedValue([]);
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric,
      };

      await controller.getHistory(mockReq, mockRes);

      // Should not return 400 for valid metrics - should call service
      expect(service.getHistory).toHaveBeenCalledWith('2026-01-01', '2026-01-31', metric);
    });

    test('should return correct error response format for validation errors', async () => {
      mockReq.query = {};

      await controller.getHistory(mockReq, mockRes);

      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('error', 'Validation Error');
      expect(jsonCall).toHaveProperty('message');
      expect(jsonCall).toHaveProperty('details');
    });

    test('should return correct error response format for server errors', async () => {
      mockReq.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        metric: 'totalProjects',
      };
      service.getHistory.mockRejectedValue(new Error('Server error'));

      await controller.getHistory(mockReq, mockRes);

      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('error');
      expect(jsonCall).toHaveProperty('message');
      expect(jsonCall).toHaveProperty('trackingId');
    });
  });
});
