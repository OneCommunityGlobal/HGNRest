// Mock all dependencies before requiring the service
jest.mock('../models/bmdashboard/summaryDashboardMetrics');
jest.mock('../models/bmdashboard/buildingProject');
jest.mock('../models/bmdashboard/buildingMaterial');
jest.mock('../startup/logger', () => ({
  logException: jest.fn().mockReturnValue('mock-tracking-id'),
  logInfo: jest.fn(),
}));

const SummaryDashboardMetrics = require('../models/bmdashboard/summaryDashboardMetrics');
const BuildingProject = require('../models/bmdashboard/buildingProject');
const BuildingMaterial = require('../models/bmdashboard/buildingMaterial');
const logger = require('../startup/logger');

// Import service after mocks are set up
const service = require('./summaryDashboard.service');

describe('summaryDashboard.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateInitialSnapshot', () => {
    const mockMaterialStats = [
      {
        _id: null,
        totalMaterialUsed: 2714,
        materialWasted: 879,
        materialAvailable: 693,
        stockBought: 4286,
      },
    ];

    const mockLaborStats = [
      {
        _id: null,
        totalLaborHours: 12800,
      },
    ];

    const setupMocks = (overrides = {}) => {
      BuildingProject.countDocuments = jest
        .fn()
        .mockResolvedValueOnce(overrides.totalProjects ?? 100) // totalProjects
        .mockResolvedValueOnce(overrides.activeProjects ?? 50) // activeProjects
        .mockResolvedValueOnce(overrides.delayedProjects ?? 10) // delayedProjects
        .mockResolvedValueOnce(overrides.completedProjects ?? 40); // completedProjects

      BuildingMaterial.aggregate = jest
        .fn()
        .mockResolvedValue(overrides.materialStats ?? mockMaterialStats);

      BuildingProject.aggregate = jest
        .fn()
        .mockResolvedValue(overrides.laborStats ?? mockLaborStats);

      const mockSave = jest.fn().mockResolvedValue(true);
      const mockInstance = {
        _id: 'mock-id',
        date: new Date(),
        snapshotType: 'current',
        metrics: {},
        save: mockSave,
      };

      // Mock the constructor
      SummaryDashboardMetrics.mockImplementation(() => mockInstance);

      return { mockInstance, mockSave };
    };

    test('should generate snapshot with correct metrics structure', async () => {
      const { mockSave } = setupMocks();

      const result = await service.generateInitialSnapshot();

      expect(result).toBeDefined();
      expect(mockSave).toHaveBeenCalled();
    });

    test('should query BuildingProject for project statistics', async () => {
      setupMocks();

      await service.generateInitialSnapshot();

      expect(BuildingProject.countDocuments).toHaveBeenCalledTimes(4);
      expect(BuildingProject.countDocuments).toHaveBeenCalledWith();
      expect(BuildingProject.countDocuments).toHaveBeenCalledWith({ isActive: true });
      expect(BuildingProject.countDocuments).toHaveBeenCalledWith({ isActive: false });
      expect(BuildingProject.countDocuments).toHaveBeenCalledWith({
        isActive: true,
        dateCreated: { $lt: expect.any(Date) },
      });
    });

    test('should query BuildingMaterial for material statistics', async () => {
      setupMocks();

      await service.generateInitialSnapshot();

      expect(BuildingMaterial.aggregate).toHaveBeenCalledWith([
        {
          $group: {
            _id: null,
            totalMaterialUsed: { $sum: '$stockUsed' },
            materialWasted: { $sum: '$stockWasted' },
            materialAvailable: { $sum: '$stockAvailable' },
            stockBought: { $sum: '$stockBought' },
          },
        },
      ]);
    });

    test('should calculate labor hours from BuildingProject.members', async () => {
      setupMocks();

      await service.generateInitialSnapshot();

      expect(BuildingProject.aggregate).toHaveBeenCalledWith([
        { $unwind: '$members' },
        {
          $group: {
            _id: null,
            totalLaborHours: { $sum: '$members.hours' },
          },
        },
      ]);
    });

    test('should use default values when aggregations return empty', async () => {
      setupMocks({
        materialStats: [],
        laborStats: [],
      });

      const result = await service.generateInitialSnapshot();

      expect(result).toBeDefined();
      expect(SummaryDashboardMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            totalMaterialUsed: expect.objectContaining({ value: 2714 }),
            materialWasted: expect.objectContaining({ value: 879 }),
            materialAvailable: expect.objectContaining({ value: 693 }),
          }),
        }),
      );
    });

    test('should calculate costs using correct constants (material: $50, labor: $25)', async () => {
      setupMocks({
        materialStats: [
          {
            stockBought: 1000,
            totalMaterialUsed: 800,
            materialWasted: 100,
            materialAvailable: 100,
          },
        ],
        laborStats: [{ totalLaborHours: 2000 }],
      });

      await service.generateInitialSnapshot();

      // Material cost: 1000 * $50 = $50000 = 50K
      // Labor cost: 2000 * $25 = $50000 = 50K
      expect(SummaryDashboardMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            totalMaterialCost: expect.objectContaining({ value: 50 }), // 50000/1000 = 50K
            totalLaborCost: expect.objectContaining({ value: 50 }), // 50000/1000 = 50K
          }),
        }),
      );
    });

    test('should calculate average project duration correctly', async () => {
      setupMocks({
        completedProjects: 10,
        laborStats: [{ totalLaborHours: 10000 }],
      });

      await service.generateInitialSnapshot();

      // avgProjectDuration = totalLaborHours / completedProjects = 10000 / 10 = 1000
      expect(SummaryDashboardMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            avgProjectDuration: expect.objectContaining({ value: 1000 }),
          }),
        }),
      );
    });

    test('should save snapshot to SummaryDashboardMetrics collection', async () => {
      const { mockSave } = setupMocks();

      await service.generateInitialSnapshot();

      expect(SummaryDashboardMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          date: expect.any(Date),
          snapshotType: 'current',
          metrics: expect.any(Object),
        }),
      );
      expect(mockSave).toHaveBeenCalled();
    });

    test('should call logger.logInfo on success', async () => {
      setupMocks();

      await service.generateInitialSnapshot();

      expect(logger.logInfo).toHaveBeenCalledWith(
        'SummaryDashboardMetrics: Initial snapshot generated',
        expect.objectContaining({
          snapshotType: 'current',
          metricsCount: 12,
        }),
      );
    });

    test('should call logger.logException on error', async () => {
      const error = new Error('Database error');
      BuildingProject.countDocuments = jest.fn().mockRejectedValue(error);
      BuildingMaterial.aggregate = jest.fn();
      BuildingProject.aggregate = jest.fn();

      await expect(service.generateInitialSnapshot()).rejects.toThrow('Database error');

      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'summaryDashboardService.generateInitialSnapshot',
        { operation: 'generateInitialSnapshot' },
      );
    });

    test('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      BuildingProject.countDocuments = jest.fn().mockRejectedValue(error);
      BuildingMaterial.aggregate = jest.fn();
      BuildingProject.aggregate = jest.fn();

      await expect(service.generateInitialSnapshot()).rejects.toThrow('Database connection failed');
    });

    test('should handle aggregation errors gracefully', async () => {
      BuildingProject.countDocuments = jest.fn().mockResolvedValue(10);
      const error = new Error('Aggregation failed');
      BuildingMaterial.aggregate = jest.fn().mockRejectedValue(error);
      BuildingProject.aggregate = jest.fn();

      await expect(service.generateInitialSnapshot()).rejects.toThrow('Aggregation failed');
    });

    test('should handle model save errors gracefully', async () => {
      BuildingProject.countDocuments = jest.fn().mockResolvedValue(10);
      BuildingMaterial.aggregate = jest.fn().mockResolvedValue(mockMaterialStats);
      BuildingProject.aggregate = jest.fn().mockResolvedValue(mockLaborStats);

      const error = new Error('Save failed');
      SummaryDashboardMetrics.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(error),
      }));

      await expect(service.generateInitialSnapshot()).rejects.toThrow('Save failed');
    });
  });

  describe('getAllMetrics', () => {
    const mockSnapshot = {
      _id: 'mock-id',
      date: new Date('2026-01-23'),
      snapshotType: 'current',
      metrics: {
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
      },
    };

    test('should return flattened metrics when snapshot exists', async () => {
      SummaryDashboardMetrics.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockSnapshot),
      });

      const result = await service.getAllMetrics();

      expect(result).toEqual({
        _id: 'mock-id',
        date: expect.any(Date),
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
      });
    });

    test('should auto-generate snapshot when collection is empty', async () => {
      // First call returns null
      SummaryDashboardMetrics.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      // Mock generateInitialSnapshot dependencies
      BuildingProject.countDocuments = jest.fn().mockResolvedValue(10);
      BuildingMaterial.aggregate = jest.fn().mockResolvedValue([]);
      BuildingProject.aggregate = jest.fn().mockResolvedValue([]);

      const generatedSnapshot = {
        _id: 'generated-id',
        date: new Date(),
        snapshotType: 'current',
        metrics: {
          totalProjects: { value: 426 },
          completedProjects: { value: 127 },
          delayedProjects: { value: 34 },
          activeProjects: { value: 265 },
          avgProjectDuration: { value: 1754 },
          totalMaterialCost: { value: 27.6 },
          totalLaborCost: { value: 18.4 },
          totalMaterialUsed: { value: 2714 },
          materialWasted: { value: 879 },
          materialAvailable: { value: 693 },
          materialUsed: { value: 1142 },
          totalLaborHours: { value: 12.8 },
        },
        save: jest.fn().mockResolvedValue(true),
      };
      SummaryDashboardMetrics.mockImplementation(() => generatedSnapshot);

      const result = await service.getAllMetrics();

      expect(result.metrics).toEqual({
        totalProjects: 426,
        completedProjects: 127,
        delayedProjects: 34,
        activeProjects: 265,
        avgProjectDuration: 1754,
        totalMaterialCost: 27.6,
        totalLaborCost: 18.4,
        totalMaterialUsed: 2714,
        materialWasted: 879,
        materialAvailable: 693,
        materialUsed: 1142,
        totalLaborHours: 12.8,
      });
    });

    test('should flatten metrics correctly (remove trends, keep values)', async () => {
      SummaryDashboardMetrics.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockSnapshot),
      });

      const result = await service.getAllMetrics();

      // Ensure no trend data in result
      Object.values(result.metrics).forEach((value) => {
        expect(typeof value).toBe('number');
      });
    });

    test('should return correct response structure (_id, date, snapshotType, metrics)', async () => {
      SummaryDashboardMetrics.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockSnapshot),
      });

      const result = await service.getAllMetrics();

      expect(result).toHaveProperty('_id');
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('snapshotType');
      expect(result).toHaveProperty('metrics');
    });

    test('should handle null metric values (default to 0)', async () => {
      const snapshotWithNulls = {
        ...mockSnapshot,
        metrics: {
          ...mockSnapshot.metrics,
          totalProjects: { value: null, trend: { value: 0, period: 'week' } },
          completedProjects: null,
        },
      };
      SummaryDashboardMetrics.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(snapshotWithNulls),
      });

      const result = await service.getAllMetrics();

      expect(result.metrics.totalProjects).toBe(0);
      expect(result.metrics.completedProjects).toBe(0);
    });
  });

  describe('getMaterialCostTrends', () => {
    const mockSnapshots = [
      {
        date: new Date('2026-01-01'),
        metrics: { totalMaterialCost: { value: 25.5 } },
      },
      {
        date: new Date('2026-01-15'),
        metrics: { totalMaterialCost: { value: 27.6 } },
      },
    ];

    test('should return time series array when snapshots exist', async () => {
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockSnapshots),
      });

      const result = await service.getMaterialCostTrends();

      expect(result).toEqual([
        { date: expect.any(Date), cost: 25.5 },
        { date: expect.any(Date), cost: 27.6 },
      ]);
    });

    test('should auto-generate snapshot when collection is empty', async () => {
      // First find returns empty, after generation returns snapshot
      SummaryDashboardMetrics.find = jest
        .fn()
        .mockReturnValueOnce({
          sort: jest.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce({
          sort: jest.fn().mockResolvedValue(mockSnapshots),
        });

      // Mock generateInitialSnapshot dependencies
      BuildingProject.countDocuments = jest.fn().mockResolvedValue(10);
      BuildingMaterial.aggregate = jest.fn().mockResolvedValue([]);
      BuildingProject.aggregate = jest.fn().mockResolvedValue([]);

      SummaryDashboardMetrics.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true),
        metrics: { totalMaterialCost: { value: 27.6 } },
      }));

      const result = await service.getMaterialCostTrends();

      expect(SummaryDashboardMetrics.find).toHaveBeenCalledTimes(2);
      expect(result.length).toBe(2);
    });

    test('should return correct time series structure (date, cost)', async () => {
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockSnapshots),
      });

      const result = await service.getMaterialCostTrends();

      result.forEach((item) => {
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('cost');
        expect(typeof item.cost).toBe('number');
      });
    });

    test('should sort snapshots by date ascending', async () => {
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockSnapshots),
      });

      await service.getMaterialCostTrends();

      expect(SummaryDashboardMetrics.find).toHaveBeenCalledWith({
        'metrics.totalMaterialCost.value': { $exists: true },
      });
      expect(SummaryDashboardMetrics.find().sort).toHaveBeenCalledWith({ date: 1 });
    });

    test('should handle snapshots with missing material cost values (default to 0)', async () => {
      const snapshotsWithMissingCost = [
        {
          date: new Date('2026-01-01'),
          metrics: { totalMaterialCost: { value: null } },
        },
        {
          date: new Date('2026-01-15'),
          metrics: { totalMaterialCost: {} },
        },
      ];
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(snapshotsWithMissingCost),
      });

      const result = await service.getMaterialCostTrends();

      expect(result[0].cost).toBe(0);
      expect(result[1].cost).toBe(0);
    });
  });

  describe('getHistory', () => {
    const mockHistorySnapshots = [
      {
        date: new Date('2026-01-01'),
        metrics: { totalProjects: { value: 95 } },
      },
      {
        date: new Date('2026-01-15'),
        metrics: { totalProjects: { value: 100 } },
      },
    ];

    test('should return history array for valid date range and metric', async () => {
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockHistorySnapshots),
      });

      const result = await service.getHistory('2026-01-01', '2026-01-31', 'totalProjects');

      expect(result).toEqual([
        { date: expect.any(Date), value: 95 },
        { date: expect.any(Date), value: 100 },
      ]);
    });

    test('should throw error for invalid date format', async () => {
      await expect(
        service.getHistory('invalid-date', '2026-01-31', 'totalProjects'),
      ).rejects.toThrow('Invalid date format');
    });

    test('should throw error when startDate is after endDate', async () => {
      await expect(service.getHistory('2026-01-31', '2026-01-01', 'totalProjects')).rejects.toThrow(
        'startDate must be before endDate',
      );
    });

    test('should query snapshots within date range', async () => {
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockHistorySnapshots),
      });

      await service.getHistory('2026-01-01', '2026-01-31', 'totalProjects');

      expect(SummaryDashboardMetrics.find).toHaveBeenCalledWith({
        date: {
          $gte: expect.any(Date),
          $lte: expect.any(Date),
        },
        'metrics.totalProjects.value': { $exists: true },
      });
    });

    test('should filter by metric name correctly', async () => {
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockHistorySnapshots),
      });

      await service.getHistory('2026-01-01', '2026-01-31', 'completedProjects');

      expect(SummaryDashboardMetrics.find).toHaveBeenCalledWith(
        expect.objectContaining({
          'metrics.completedProjects.value': { $exists: true },
        }),
      );
    });

    test('should return correct history structure (date, value)', async () => {
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockHistorySnapshots),
      });

      const result = await service.getHistory('2026-01-01', '2026-01-31', 'totalProjects');

      result.forEach((item) => {
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('value');
        expect(typeof item.value).toBe('number');
      });
    });

    test('should sort results by date ascending', async () => {
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockHistorySnapshots),
      });

      await service.getHistory('2026-01-01', '2026-01-31', 'totalProjects');

      expect(SummaryDashboardMetrics.find().sort).toHaveBeenCalledWith({ date: 1 });
    });

    test('should handle missing metric values (default to 0)', async () => {
      const snapshotsWithMissingMetric = [
        {
          date: new Date('2026-01-01'),
          metrics: { totalProjects: { value: null } },
        },
        {
          date: new Date('2026-01-15'),
          metrics: { totalProjects: {} },
        },
      ];
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(snapshotsWithMissingMetric),
      });

      const result = await service.getHistory('2026-01-01', '2026-01-31', 'totalProjects');

      expect(result[0].value).toBe(0);
      expect(result[1].value).toBe(0);
    });

    test('should call logger.logException on error', async () => {
      const error = new Error('Database error');
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockRejectedValue(error),
      });

      await expect(service.getHistory('2026-01-01', '2026-01-31', 'totalProjects')).rejects.toThrow(
        'Database error',
      );

      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'summaryDashboardService.getHistory',
        {
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          metric: 'totalProjects',
        },
      );
    });

    test('should handle database query errors', async () => {
      const error = new Error('Query failed');
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockRejectedValue(error),
      });

      await expect(service.getHistory('2026-01-01', '2026-01-31', 'totalProjects')).rejects.toThrow(
        'Query failed',
      );
    });
  });

  describe('isValidDate helper (tested through getHistory)', () => {
    test('should return true for valid date strings', async () => {
      SummaryDashboardMetrics.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      // Valid dates should not throw
      await expect(
        service.getHistory('2026-01-01', '2026-12-31', 'totalProjects'),
      ).resolves.toEqual([]);
    });

    test('should return false for invalid date strings', async () => {
      await expect(service.getHistory('not-a-date', '2026-01-31', 'totalProjects')).rejects.toThrow(
        'Invalid date format',
      );
    });

    test('should return false for NaN dates', async () => {
      await expect(service.getHistory('NaN', '2026-01-31', 'totalProjects')).rejects.toThrow(
        'Invalid date format',
      );
    });
  });
});
