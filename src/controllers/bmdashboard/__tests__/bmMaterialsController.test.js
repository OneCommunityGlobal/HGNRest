// Mock utilities BEFORE requiring the controller
// Note: Paths are relative to the controller file, not the test file
jest.mock(
  '../../../utilities/queryParamParser',
  () => ({
    parseMultiSelectQueryParam: jest.fn(),
  }),
  { virtual: true },
);
jest.mock(
  '../../../utilities/materialCostCorrelationDateUtils',
  () => ({
    parseAndNormalizeDateRangeUTC: jest.fn(),
    normalizeStartDate: jest.fn(),
  }),
  { virtual: true },
);
jest.mock(
  '../../../utilities/materialCostCorrelationHelpers',
  () => ({
    getEarliestRelevantMaterialDate: jest.fn(),
    aggregateMaterialUsage: jest.fn(),
    aggregateMaterialCost: jest.fn(),
    buildCostCorrelationResponse: jest.fn(),
  }),
  { virtual: true },
);
jest.mock(
  '../../../startup/logger',
  () => ({
    logException: jest.fn(),
  }),
  { virtual: true },
);
jest.mock('../../../models/bmdashboard/buildingProject', () => ({}), { virtual: true });
jest.mock(
  '../../../models/bmdashboard/buildingInventoryType',
  () => ({
    invTypeBase: {},
  }),
  { virtual: true },
);

const mongoose = require('mongoose');
const bmMaterialsController = require('../bmMaterialsController');
// Get mocked functions - use paths relative to controller
const {
  parseMultiSelectQueryParam: mockParseMultiSelectQueryParam,
} = require('../../../utilities/queryParamParser');
const {
  parseAndNormalizeDateRangeUTC: mockParseAndNormalizeDateRangeUTC,
  normalizeStartDate: mockNormalizeStartDate,
} = require('../../../utilities/materialCostCorrelationDateUtils');
const {
  getEarliestRelevantMaterialDate: mockGetEarliestRelevantMaterialDate,
  aggregateMaterialUsage: mockAggregateMaterialUsage,
  aggregateMaterialCost: mockAggregateMaterialCost,
  buildCostCorrelationResponse: mockBuildCostCorrelationResponse,
} = require('../../../utilities/materialCostCorrelationHelpers');
const { logException: mockLogException } = require('../../../startup/logger');

// Mock mongoose models
const mockExec = jest.fn();
const mockThen = jest.fn().mockImplementation((callback) => {
  callback();
  return { catch: jest.fn() };
});
const mockCatch = jest.fn();
const mockPopulate = jest.fn().mockReturnThis();
const mockFind = jest.fn().mockReturnThis();
const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockFindOneAndUpdate = jest.fn();
const mockUpdateOne = jest.fn();

// Mock BuildingMaterial model
const mockAggregate = jest.fn().mockReturnValue({
  exec: jest.fn().mockResolvedValue([]),
});

const BuildingMaterial = {
  find: mockFind,
  findOne: mockFindOne,
  create: mockCreate,
  findOneAndUpdate: mockFindOneAndUpdate,
  updateOne: mockUpdateOne,
  populate: mockPopulate,
  exec: mockExec,
  aggregate: mockAggregate,
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockExec.mockReturnValue({ then: mockThen });
  mockFind.mockReturnThis();
  mockPopulate.mockReturnThis();
});

describe('bmMaterialsController', () => {
  // Initialize controller by passing the mock BuildingMaterial model
  const controller = bmMaterialsController(BuildingMaterial);

  describe('bmMaterialsList', () => {
    it('should fetch and return materials list', async () => {
      const mockResults = [{ name: 'Cement', quantity: 100 }];
      // Fix the chaining of populate calls
      mockPopulate.mockImplementation(() => ({
        populate: mockPopulate,
        exec() {
          return {
            then(callback) {
              callback(mockResults);
              return { catch: mockCatch };
            },
          };
        },
      }));

      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn(),
      };

      await controller.bmMaterialsList(req, res);

      expect(mockFind).toHaveBeenCalled();
      expect(mockPopulate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockResults);
    });

    it('should handle errors during fetch', async () => {
      const mockError = new Error('Database error');
      mockThen.mockImplementation(() => ({
        catch(callback) {
          callback(mockError);
        },
      }));

      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn(),
      };

      await controller.bmMaterialsList(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(mockError);
    });
  });

  describe('bmPurchaseMaterials', () => {
    it('should create a new material if not found', async () => {
      mockFindOne.mockResolvedValue(null);
      mockCreate.mockImplementation(() => ({
        then(callback) {
          callback();
          return { catch: jest.fn() };
        },
      }));

      const req = {
        body: {
          primaryId: 'project123',
          secondaryId: 'matType123',
          quantity: 50,
          priority: 'high',
          brand: 'BrandX',
          requestor: { requestorId: 'user123' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmPurchaseMaterials(req, res);

      expect(mockFindOne).toHaveBeenCalledWith({
        project: 'project123',
        itemType: 'matType123',
      });
      expect(mockCreate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalled();
    });

    it('should update an existing material if found', async () => {
      const mockMaterial = { _id: 'material123' };
      mockFindOne.mockResolvedValue(mockMaterial);

      mongoose.Types.ObjectId = jest.fn().mockReturnValue('material123');

      mockFindOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockReturnValue({
          then: jest.fn().mockImplementation((callback) => {
            callback();
            return { catch: jest.fn() };
          }),
        }),
      });

      const req = {
        body: {
          primaryId: 'project123',
          secondaryId: 'matType123',
          quantity: 50,
          priority: 'high',
          brand: 'BrandX',
          requestor: { requestorId: 'user123' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmPurchaseMaterials(req, res);

      expect(mockFindOne).toHaveBeenCalledWith({
        project: 'project123',
        itemType: 'matType123',
      });
      expect(mockFindOneAndUpdate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockFindOne.mockRejectedValue(new Error('Database error'));

      const req = {
        body: {
          primaryId: 'project123',
          secondaryId: 'matType123',
          quantity: 50,
          priority: 'high',
          brand: 'BrandX',
          requestor: { requestorId: 'user123' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmPurchaseMaterials(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('bmPostMaterialUpdateRecord', () => {
    it('should update material stock and add update record', async () => {
      mockUpdateOne.mockReturnValue({
        then(callback) {
          callback({ nModified: 1 });
          return { catch: jest.fn() };
        },
      });

      const material = {
        _id: 'material123',
        stockAvailable: 100,
        stockUsed: 20,
        stockWasted: 10,
      };

      const req = {
        body: {
          material,
          quantityUsed: 5,
          quantityWasted: 2,
          date: '2023-01-01',
          requestor: { requestorId: 'user123' },
          QtyUsedLogUnit: 'unit',
          QtyWastedLogUnit: 'unit',
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmPostMaterialUpdateRecord(req, res);

      expect(mockUpdateOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalled();
    });

    it('should reject if stock quantities exceed available', async () => {
      const material = {
        _id: 'material123',
        stockAvailable: 10,
        stockUsed: 5,
        stockWasted: 2,
      };

      const req = {
        body: {
          material,
          quantityUsed: 15, // More than available
          quantityWasted: 0,
          QtyUsedLogUnit: 'unit',
          QtyWastedLogUnit: 'unit',
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmPostMaterialUpdateRecord(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('exceeds the total stock available'),
      );
    });
  });

  describe('bmupdatePurchaseStatus', () => {
    // Skipping this test because the update logic in bmupdatePurchaseStatus is commented out in main
    // it('should update purchase status to Approved and increase stock', async () => {
    //   const mockMaterial = {
    //     purchaseRecord: [{ _id: 'purchase123', status: 'Pending' }],
    //   };

    //   mockFindOne.mockResolvedValue(mockMaterial);
    //   mockFindOneAndUpdate.mockResolvedValue({ status: 'Approved' });

    //   const req = {
    //     body: {
    //       purchaseId: 'purchase123',
    //       status: 'Approved',
    //       quantity: 30,
    //     },
    //   };
    //   const res = {
    //     status: jest.fn().mockReturnThis(),
    //     send: jest.fn(),
    //   };

    //   await controller.bmupdatePurchaseStatus(req, res);

    //   expect(mockFindOne).toHaveBeenCalledWith({ 'purchaseRecord._id': 'purchase123' });
    //   expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
    //     { 'purchaseRecord._id': 'purchase123' },
    //     {
    //       $set: { 'purchaseRecord.$.status': 'Approved' },
    //       $inc: { stockBought: 30 },
    //     },
    //     { new: true },
    //   );
    //   expect(res.status).toHaveBeenCalledWith(200);
    //   expect(res.send).toHaveBeenCalledWith('Purchase approved successfully');
    // });

    it('should return 404 if purchase not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = {
        body: {
          purchaseId: 'nonexistent',
          status: 'Approved',
          quantity: 30,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmupdatePurchaseStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Purchase not found');
    });

    it('should reject if purchase is not in Pending status', async () => {
      const mockMaterial = {
        purchaseRecord: [{ _id: 'purchase123', status: 'Rejected' }],
      };

      mockFindOne.mockResolvedValue(mockMaterial);

      const req = {
        body: {
          purchaseId: 'purchase123',
          status: 'Approved',
          quantity: 30,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmupdatePurchaseStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining("can only be updated from 'Pending'"),
      );
    });
  });

  describe('bmGetMaterialCostCorrelation', () => {
    let mockReq;
    let mockRes;
    const FIXED_NOW = new Date('2024-01-15T12:30:45.123Z');

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      jest.setSystemTime(FIXED_NOW);

      mockReq = {
        method: 'GET',
        path: '/api/bm/materials/cost-correlation',
        query: {},
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      // Default mock implementations
      mockParseMultiSelectQueryParam.mockImplementation((req, param, requireObjectId) => {
        if (param === 'projectId') {
          return req.query && req.query.projectId ? [req.query.projectId] : [];
        }
        if (param === 'materialType') {
          return req.query && req.query.materialType ? [req.query.materialType] : [];
        }
        return [];
      });

      mockParseAndNormalizeDateRangeUTC.mockResolvedValue({
        effectiveStart: new Date('2024-01-01T00:00:00.000Z'),
        effectiveEnd: new Date('2024-01-31T23:59:59.999Z'),
        defaultsApplied: { startDate: false, endDate: false },
        endCappedToNowMinus5Min: false,
        originalInputs: { startDateInput: '2024-01-01', endDateInput: '2024-01-31' },
      });

      mockGetEarliestRelevantMaterialDate.mockResolvedValue(new Date('2024-01-01T00:00:00.000Z'));
      mockNormalizeStartDate.mockImplementation((date) => {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      });

      mockAggregateMaterialUsage.mockResolvedValue([
        { projectId: 'project1', materialTypeId: 'material1', quantityUsed: 100 },
      ]);

      mockAggregateMaterialCost.mockResolvedValue([
        { projectId: 'project1', materialTypeId: 'material1', totalCost: 5000 },
      ]);

      mockBuildCostCorrelationResponse.mockResolvedValue({
        meta: {
          request: { projectIds: [], materialTypeIds: [] },
          range: { effectiveStart: '2024-01-01', effectiveEnd: '2024-01-31' },
          units: { currency: 'USD', costScale: { raw: 1, k: 1000 } },
        },
        data: [],
      });

      mockLogException.mockClear();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe('Category 1: Successful Request Flow', () => {
      it('should return 200 with correct response for complete flow with all parameters', async () => {
        mockReq.query = {
          projectId: '507f1f77bcf86cd799439011',
          materialType: '507f1f77bcf86cd799439012',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockParseMultiSelectQueryParam).toHaveBeenCalledWith(mockReq, 'projectId', true);
        expect(mockParseMultiSelectQueryParam).toHaveBeenCalledWith(mockReq, 'materialType', true);
        expect(mockParseAndNormalizeDateRangeUTC).toHaveBeenCalled();
        expect(mockAggregateMaterialUsage).toHaveBeenCalled();
        expect(mockAggregateMaterialCost).toHaveBeenCalled();
        expect(mockBuildCostCorrelationResponse).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalled();
      });

      it('should compute default start date when not provided', async () => {
        mockReq.query = {
          projectId: '507f1f77bcf86cd799439011',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockGetEarliestRelevantMaterialDate).toHaveBeenCalled();
        expect(mockParseAndNormalizeDateRangeUTC).toHaveBeenCalledWith(
          undefined,
          '2024-01-31',
          expect.any(Date),
          undefined,
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should use current date for end date when not provided', async () => {
        mockReq.query = {
          projectId: '507f1f77bcf86cd799439011',
          startDate: '2024-01-01',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockParseAndNormalizeDateRangeUTC).toHaveBeenCalledWith(
          '2024-01-01',
          undefined,
          undefined,
          undefined,
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should use both defaults when neither date provided', async () => {
        mockReq.query = {
          projectId: '507f1f77bcf86cd799439011',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockGetEarliestRelevantMaterialDate).toHaveBeenCalled();
        expect(mockParseAndNormalizeDateRangeUTC).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should handle no filters (all projects/materials)', async () => {
        mockReq.query = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockAggregateMaterialUsage).toHaveBeenCalledWith(
          BuildingMaterial,
          { projectIds: [], materialTypeIds: [] },
          expect.any(Object),
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Category 2: Query Parameter Validation Errors', () => {
      it('should return 400 for invalid projectId', async () => {
        const error = {
          type: 'OBJECTID_VALIDATION_ERROR',
          message: 'Invalid ObjectId in projectId',
          invalidValues: ['invalid-id'],
        };
        mockParseMultiSelectQueryParam.mockImplementationOnce(() => {
          throw error;
        });

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: error.message });
        // Validation errors are expected and not logged as exceptions
      });

      it('should return 400 for invalid materialType', async () => {
        const error = {
          type: 'OBJECTID_VALIDATION_ERROR',
          message: 'Invalid ObjectId in materialType',
          invalidValues: ['invalid-id'],
        };
        mockParseMultiSelectQueryParam
          .mockReturnValueOnce([]) // projectId succeeds
          .mockImplementationOnce(() => {
            throw error;
          });

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: error.message });
      });

      it('should handle empty but valid parameters', async () => {
        mockReq.query = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockAggregateMaterialUsage).toHaveBeenCalledWith(
          BuildingMaterial,
          { projectIds: [], materialTypeIds: [] },
          expect.any(Object),
        );
      });
    });

    describe('Category 3: Date Parsing Errors', () => {
      it('should return 422 for invalid start date format', async () => {
        const error = {
          type: 'DATE_PARSE_ERROR',
          message: 'Invalid date format',
          acceptedFormats: ['YYYY-MM-DD'],
        };
        // parseAndNormalizeDateRangeUTC is synchronous, so we use mockImplementationOnce to throw
        mockParseAndNormalizeDateRangeUTC.mockImplementationOnce(() => {
          throw error;
        });

        mockReq.query = {
          startDate: 'invalid-date',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(422);
        expect(mockRes.json).toHaveBeenCalledWith({ error: error.message });
        // Validation errors are expected and not logged as exceptions
      });

      it('should return 422 for invalid end date format', async () => {
        const error = {
          type: 'DATE_PARSE_ERROR',
          message: 'Invalid date format',
        };
        // parseAndNormalizeDateRangeUTC is synchronous, so we use mockImplementationOnce to throw
        mockParseAndNormalizeDateRangeUTC.mockImplementationOnce(() => {
          throw error;
        });

        mockReq.query = {
          startDate: '2024-01-01',
          endDate: 'invalid-date',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(422);
        expect(mockRes.json).toHaveBeenCalledWith({ error: error.message });
      });

      it('should return 400 for invalid date range (start after end)', async () => {
        const error = {
          type: 'DATE_RANGE_ERROR',
          message: 'Start date must be less than or equal to end date',
        };
        // parseAndNormalizeDateRangeUTC is synchronous, so we use mockImplementationOnce to throw
        mockParseAndNormalizeDateRangeUTC.mockImplementationOnce(() => {
          throw error;
        });

        mockReq.query = {
          startDate: '2024-01-31',
          endDate: '2024-01-01',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: error.message });
        // Validation errors are expected and not logged as exceptions
      });
    });

    describe('Category 4: Aggregation Errors', () => {
      it('should return 500 when aggregateMaterialUsage fails', async () => {
        const error = new Error('Database error');
        mockAggregateMaterialUsage.mockRejectedValueOnce(error);

        mockReq.query = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Internal server error while aggregating material data',
        });
        expect(mockLogException).toHaveBeenCalledWith(
          error,
          'bmGetMaterialCostCorrelation - aggregation',
          expect.any(Object),
        );
      });

      it('should return 500 when aggregateMaterialCost fails', async () => {
        const error = new Error('Database error');
        mockAggregateMaterialCost.mockRejectedValueOnce(error);

        mockReq.query = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Internal server error while aggregating material data',
        });
      });

      it('should handle both aggregations failing', async () => {
        const error = new Error('Database error');
        mockAggregateMaterialUsage.mockRejectedValueOnce(error);
        mockAggregateMaterialCost.mockRejectedValueOnce(error);

        mockReq.query = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
      });
    });

    describe('Category 5: Response Building Errors', () => {
      it('should return 500 when buildCostCorrelationResponse fails', async () => {
        const error = new Error('Response building error');
        mockBuildCostCorrelationResponse.mockRejectedValueOnce(error);

        mockReq.query = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Internal server error while building response',
        });
        expect(mockLogException).toHaveBeenCalledWith(
          error,
          'bmGetMaterialCostCorrelation - response building',
          expect.any(Object),
        );
      });
    });

    describe('Category 6: Default Date Computation', () => {
      it('should use earliest date when found', async () => {
        const earliestDate = new Date('2023-06-01T00:00:00.000Z');
        mockGetEarliestRelevantMaterialDate.mockResolvedValueOnce(earliestDate);

        mockReq.query = {
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockGetEarliestRelevantMaterialDate).toHaveBeenCalled();
        expect(mockParseAndNormalizeDateRangeUTC).toHaveBeenCalledWith(
          undefined,
          '2024-01-31',
          earliestDate,
          undefined,
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should use today as fallback when no earliest date found', async () => {
        mockGetEarliestRelevantMaterialDate.mockResolvedValueOnce(null);

        mockReq.query = {
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockGetEarliestRelevantMaterialDate).toHaveBeenCalled();
        expect(mockNormalizeStartDate).toHaveBeenCalled();
        expect(mockParseAndNormalizeDateRangeUTC).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should handle earliest date computation error gracefully', async () => {
        // When getEarliestRelevantMaterialDate throws, it's caught by the global catch block
        const error = new Error('DB error');
        mockGetEarliestRelevantMaterialDate.mockRejectedValueOnce(error);

        mockReq.query = {
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        // Error should be caught by global catch and return 500
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(mockLogException).toHaveBeenCalledWith(
          error,
          'bmGetMaterialCostCorrelation - unexpected error',
          expect.any(Object),
        );
      });
    });

    describe('Category 7: Parallel Aggregation Execution', () => {
      it('should execute both aggregations in parallel', async () => {
        mockReq.query = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockAggregateMaterialUsage).toHaveBeenCalled();
        expect(mockAggregateMaterialCost).toHaveBeenCalled();
        // Both should be called with same filters and dateRange
        const usageCall = mockAggregateMaterialUsage.mock.calls[0];
        const costCall = mockAggregateMaterialCost.mock.calls[0];
        expect(usageCall[1]).toEqual(costCall[1]); // filters
        expect(usageCall[2]).toEqual(costCall[2]); // dateRange
      });
    });

    describe('Category 8: Response Structure Validation', () => {
      it('should return response with correct structure', async () => {
        const mockResponse = {
          meta: {
            request: { projectIds: [], materialTypeIds: [] },
            range: { effectiveStart: '2024-01-01', effectiveEnd: '2024-01-31' },
            units: { currency: 'USD', costScale: { raw: 1, k: 1000 } },
          },
          data: [
            {
              projectId: 'project1',
              projectName: 'Project 1',
              totals: { quantityUsed: 100, totalCost: 5000, totalCostK: 5, costPerUnit: 50 },
              byMaterialType: [],
            },
          ],
        };
        mockBuildCostCorrelationResponse.mockResolvedValueOnce(mockResponse);

        mockReq.query = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith(mockResponse);
        expect(mockResponse.meta).toBeDefined();
        expect(Array.isArray(mockResponse.data)).toBe(true);
      });
    });

    describe('Category 9: Edge Cases', () => {
      it('should handle empty results gracefully', async () => {
        mockAggregateMaterialUsage.mockResolvedValueOnce([]);
        mockAggregateMaterialCost.mockResolvedValueOnce([]);
        mockBuildCostCorrelationResponse.mockResolvedValueOnce({
          meta: {},
          data: [],
        });

        mockReq.query = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalled();
      });

      it('should handle missing req.query gracefully', async () => {
        mockReq.query = undefined;

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        // Should not throw, should handle gracefully
        expect(mockParseMultiSelectQueryParam).toHaveBeenCalled();
      });
    });

    describe('Category 10: Logging Verification', () => {
      it('should NOT log validation errors as exceptions (query param errors)', async () => {
        const error = {
          type: 'OBJECTID_VALIDATION_ERROR',
          message: 'Invalid ObjectId',
        };
        mockParseMultiSelectQueryParam.mockImplementationOnce(() => {
          throw error;
        });

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        // Validation errors should NOT be logged as exceptions
        expect(mockLogException).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      it('should NOT log validation errors as exceptions (date errors)', async () => {
        const error = {
          type: 'DATE_PARSE_ERROR',
          message: 'Invalid date',
        };
        // parseAndNormalizeDateRangeUTC is synchronous, so we use mockImplementationOnce to throw
        mockParseAndNormalizeDateRangeUTC.mockImplementationOnce(() => {
          throw error;
        });

        mockReq.query = {
          startDate: 'invalid',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        // Validation errors should NOT be logged as exceptions
        expect(mockLogException).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(422);
      });

      it('should log aggregation errors', async () => {
        const error = new Error('Aggregation error');
        mockAggregateMaterialUsage.mockRejectedValueOnce(error);

        mockReq.query = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockLogException).toHaveBeenCalledWith(
          error,
          'bmGetMaterialCostCorrelation - aggregation',
          expect.any(Object),
        );
      });

      it('should log response building errors', async () => {
        const error = new Error('Response error');
        mockBuildCostCorrelationResponse.mockRejectedValueOnce(error);

        mockReq.query = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockLogException).toHaveBeenCalledWith(
          error,
          'bmGetMaterialCostCorrelation - response building',
          expect.any(Object),
        );
      });

      it('should log unexpected errors', async () => {
        const error = new Error('Unexpected error');
        mockParseMultiSelectQueryParam.mockImplementationOnce(() => {
          throw error;
        });

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockLogException).toHaveBeenCalledWith(
          error,
          'bmGetMaterialCostCorrelation - unexpected error',
          expect.any(Object),
        );
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      });
    });
  });
});
