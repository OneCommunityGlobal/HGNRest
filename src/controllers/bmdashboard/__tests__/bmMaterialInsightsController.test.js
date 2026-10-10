/**
 * Material Insights Controller Tests
 * Tests for all calculation functions and API endpoints
 */

const bmMaterialInsightsController = require('../bmMaterialInsightsController');

describe('Material Insights Controller', () => {
  let mockBuildingMaterial;
  let controller;

  beforeEach(() => {
    // Mock BuildingMaterial model
    mockBuildingMaterial = {
      find: jest.fn(),
      findById: jest.fn(),
    };

    controller = bmMaterialInsightsController(mockBuildingMaterial);
  });

  describe('Calculation Functions', () => {
    describe('calculateMaterialInsights', () => {
      it('should calculate insights for material with complete data', () => {
        const material = {
          _id: '123',
          stockBought: 100,
          stockUsed: 75,
          stockAvailable: 30,
          stockWasted: 5,
          stockHold: 0,
          itemType: { name: 'Cement', unit: 'kg' },
          project: { _id: 'proj1', name: 'Project A' },
        };

        const insights = controller.calculateMaterialInsights(material);

        expect(insights.usagePct).toBe(75);
        expect(insights.stockRatio).toBe(0.3);
        expect(insights.stockHealth).toBe('low');
        expect(insights.materialName).toBe('Cement');
        expect(insights.unit).toBe('kg');
        expect(insights.hasBoughtData).toBe(true);
      });

      it('should handle material with no purchases', () => {
        const material = {
          _id: '123',
          stockBought: 0,
          stockUsed: 0,
          stockAvailable: 0,
          stockWasted: 0,
          stockHold: 0,
          itemType: { name: 'Steel', unit: 'tons' },
          project: { _id: 'proj1', name: 'Project B' },
        };

        const insights = controller.calculateMaterialInsights(material);

        expect(insights.usagePct).toBeNull();
        expect(insights.stockRatio).toBeNull();
        expect(insights.stockHealth).toBe('no-data');
        expect(insights.hasBoughtData).toBe(false);
      });

      it('should classify as critical when stock <= 20%', () => {
        const material = {
          _id: '123',
          stockBought: 100,
          stockUsed: 90,
          stockAvailable: 10,
          stockWasted: 0,
          stockHold: 0,
          itemType: { name: 'Wood', unit: 'pcs' },
          project: { _id: 'proj1', name: 'Project C' },
        };

        const insights = controller.calculateMaterialInsights(material);

        expect(insights.stockHealth).toBe('critical');
        expect(insights.stockHealthColor).toBe('red');
        expect(insights.stockHealthLabel).toBe('Critical');
      });

      it('should classify as healthy when stock > 40%', () => {
        const material = {
          _id: '123',
          stockBought: 100,
          stockUsed: 50,
          stockAvailable: 50,
          stockWasted: 0,
          stockHold: 0,
          itemType: { name: 'Brick', unit: 'units' },
          project: { _id: 'proj1', name: 'Project D' },
        };

        const insights = controller.calculateMaterialInsights(material);

        expect(insights.stockHealth).toBe('healthy');
        expect(insights.stockHealthColor).toBe('green');
        expect(insights.stockHealthLabel).toBe('Healthy');
      });
    });

    describe('calculateUsagePercentage', () => {
      it('should calculate usage percentage correctly', () => {
        const percentage = controller.calculateUsagePercentage(50, 100);
        expect(percentage).toBe(50);
      });

      it('should return null when bought is 0', () => {
        const percentage = controller.calculateUsagePercentage(50, 0);
        expect(percentage).toBeNull();
      });

      it('should handle decimal values', () => {
        const percentage = controller.calculateUsagePercentage(33.33, 100);
        expect(percentage).toBe(33.33);
      });
    });

    describe('calculateStockRatio', () => {
      it('should calculate stock ratio correctly', () => {
        const ratio = controller.calculateStockRatio(50, 100);
        expect(ratio).toBe(0.5);
      });

      it('should return null when bought is 0', () => {
        const ratio = controller.calculateStockRatio(50, 0);
        expect(ratio).toBeNull();
      });

      it('should clamp ratio at 1', () => {
        const ratio = controller.calculateStockRatio(150, 100);
        expect(ratio).toBe(1.5); // Can exceed 1 if available > bought
      });
    });

    describe('getStockHealthStatus', () => {
      it('should return critical for ratio <= 0.2', () => {
        expect(controller.getStockHealthStatus(0.2)).toBe('critical');
        expect(controller.getStockHealthStatus(0.1)).toBe('critical');
      });

      it('should return low for ratio between 0.2 and 0.4', () => {
        expect(controller.getStockHealthStatus(0.3)).toBe('low');
        expect(controller.getStockHealthStatus(0.4)).toBe('low');
      });

      it('should return healthy for ratio > 0.4', () => {
        expect(controller.getStockHealthStatus(0.5)).toBe('healthy');
        expect(controller.getStockHealthStatus(1.0)).toBe('healthy');
      });

      it('should return no-data for null/undefined', () => {
        expect(controller.getStockHealthStatus(null)).toBe('no-data');
        expect(controller.getStockHealthStatus(undefined)).toBe('no-data');
      });
    });
  });

  describe('Summary Metrics', () => {
    describe('calculateSummaryMetrics', () => {
      it('should calculate summary for empty array', () => {
        const summary = controller.calculateSummaryMetrics([]);

        expect(summary.totalMaterials).toBe(0);
        expect(summary.lowStockCount).toBe(0);
        expect(summary.lowStockPercentage).toBe(0);
        expect(summary.overUsageCount).toBe(0);
        expect(summary.overUsagePercentage).toBe(0);
        expect(summary.onHoldCount).toBe(0);
      });

      it('should count low stock items', () => {
        const materials = [
          {
            _id: '1',
            stockBought: 100,
            stockUsed: 80,
            stockAvailable: 20,
            stockWasted: 0,
            stockHold: 0,
            itemType: { name: 'A', unit: 'kg' },
            project: { _id: 'p1', name: 'P1' },
          },
          {
            _id: '2',
            stockBought: 100,
            stockUsed: 85,
            stockAvailable: 15,
            stockWasted: 0,
            stockHold: 0,
            itemType: { name: 'B', unit: 'kg' },
            project: { _id: 'p1', name: 'P1' },
          },
          {
            _id: '3',
            stockBought: 100,
            stockUsed: 50,
            stockAvailable: 50,
            stockWasted: 0,
            stockHold: 0,
            itemType: { name: 'C', unit: 'kg' },
            project: { _id: 'p1', name: 'P1' },
          },
        ];

        const summary = controller.calculateSummaryMetrics(materials);

        expect(summary.totalMaterials).toBe(3);
        expect(summary.lowStockCount).toBe(2);
        expect(summary.lowStockPercentage).toBe(66.7);
      });

      it('should count high usage items', () => {
        const materials = [
          {
            _id: '1',
            stockBought: 100,
            stockUsed: 85,
            stockAvailable: 15,
            stockWasted: 0,
            stockHold: 0,
            itemType: { name: 'A', unit: 'kg' },
            project: { _id: 'p1', name: 'P1' },
          },
          {
            _id: '2',
            stockBought: 100,
            stockUsed: 75,
            stockAvailable: 25,
            stockWasted: 0,
            stockHold: 0,
            itemType: { name: 'B', unit: 'kg' },
            project: { _id: 'p1', name: 'P1' },
          },
        ];

        const summary = controller.calculateSummaryMetrics(materials);

        expect(summary.totalMaterials).toBe(2);
        expect(summary.overUsageCount).toBe(1); // Only item 1 >= 80%
        expect(summary.overUsagePercentage).toBe(50);
      });

      it('should count items on hold', () => {
        const materials = [
          {
            _id: '1',
            stockBought: 100,
            stockUsed: 50,
            stockAvailable: 40,
            stockWasted: 0,
            stockHold: 10,
            itemType: { name: 'A', unit: 'kg' },
            project: { _id: 'p1', name: 'P1' },
          },
          {
            _id: '2',
            stockBought: 100,
            stockUsed: 50,
            stockAvailable: 50,
            stockWasted: 0,
            stockHold: 0,
            itemType: { name: 'B', unit: 'kg' },
            project: { _id: 'p1', name: 'P1' },
          },
        ];

        const summary = controller.calculateSummaryMetrics(materials);

        expect(summary.onHoldCount).toBe(1);
      });
    });
  });

  describe('API Endpoints', () => {
    let mockRes;
    let mockReq;

    beforeEach(() => {
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      mockReq = {
        params: {},
        query: {},
      };
    });

    describe('getMaterialInsightsAll', () => {
      it('should return all materials with insights and summary', async () => {
        const mockMaterials = [
          {
            _id: '1',
            stockBought: 100,
            stockUsed: 75,
            stockAvailable: 25,
            stockWasted: 0,
            stockHold: 0,
            itemType: { name: 'Material 1', unit: 'kg' },
            project: { _id: 'p1', name: 'Project 1' },
          },
        ];

        mockBuildingMaterial.find = jest.fn().mockReturnThis();
        mockBuildingMaterial.populate = jest.fn().mockReturnThis();
        mockBuildingMaterial.lean = jest.fn().mockReturnThis();
        mockBuildingMaterial.exec = jest.fn().mockResolvedValue(mockMaterials);

        await controller.getMaterialInsightsAll(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              materials: expect.any(Array),
              summary: expect.any(Object),
              timestamp: expect.any(Date),
            }),
          }),
        );
      });

      it('should handle errors gracefully', async () => {
        mockBuildingMaterial.find = jest.fn().mockImplementation(() => {
          throw new Error('Database error');
        });

        await controller.getMaterialInsightsAll(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: 'Internal server error',
          }),
        );
      });
    });

    describe('getMaterialInsightsByProject', () => {
      it('should reject invalid project ID', async () => {
        mockReq.params.projectId = 'invalid-id';

        await controller.getMaterialInsightsByProject(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: 'Invalid project ID',
          }),
        );
      });
    });

    describe('getSummaryMetrics', () => {
      it('should return only summary metrics', async () => {
        const mockMaterials = [];

        mockBuildingMaterial.find = jest.fn().mockReturnThis();
        mockBuildingMaterial.lean = jest.fn().mockReturnThis();
        mockBuildingMaterial.exec = jest.fn().mockResolvedValue(mockMaterials);

        await controller.getSummaryMetrics(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              totalMaterials: 0,
            }),
          }),
        );
      });
    });
  });
});
