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
    resolveProjectNamesToIds: jest.fn().mockResolvedValue([]),
    resolveMaterialNamesToIds: jest.fn().mockResolvedValue([]),
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
  resolveProjectNamesToIds: mockResolveProjectNamesToIds,
  resolveMaterialNamesToIds: mockResolveMaterialNamesToIds,
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
const mockLean = jest.fn().mockReturnThis();
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
  lean: mockLean,
  exec: mockExec,
  aggregate: mockAggregate,
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockExec.mockReturnValue({ then: mockThen });
  mockFind.mockReturnThis();
  mockPopulate.mockReturnThis();
  mockLean.mockReturnThis();
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
    const validProjectId = '507f1f77bcf86cd799439011';
    const validMatTypeId = '507f1f77bcf86cd799439012';
    const validRequestorId = '507f1f77bcf86cd799439013';

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
          primaryId: validProjectId,
          secondaryId: validMatTypeId,
          quantity: 50,
          priority: 'Low',
          brand: 'BrandX',
          requestor: { requestorId: validRequestorId },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.bmPurchaseMaterials(req, res);

      expect(mockFindOne).toHaveBeenCalledWith({
        project: expect.any(mongoose.Types.ObjectId),
        itemType: expect.any(mongoose.Types.ObjectId),
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          project: expect.any(mongoose.Types.ObjectId),
          itemType: expect.any(mongoose.Types.ObjectId),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalled();
    });

    it('should update an existing material if found', async () => {
      const mockMaterial = {
        _id: '507f1f77bcf86cd799439014',
        stockBought: 100,
      };
      mockFindOne.mockResolvedValue(mockMaterial);

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
          primaryId: validProjectId,
          secondaryId: validMatTypeId,
          quantity: 50,
          priority: 'Low',
          brand: 'BrandX',
          requestor: { requestorId: validRequestorId },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.bmPurchaseMaterials(req, res);

      expect(mockFindOne).toHaveBeenCalledWith({
        project: expect.any(mongoose.Types.ObjectId),
        itemType: expect.any(mongoose.Types.ObjectId),
      });
      expect(mockFindOneAndUpdate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockFindOne.mockRejectedValue(new Error('Database error'));

      const req = {
        body: {
          primaryId: validProjectId,
          secondaryId: validMatTypeId,
          quantity: 50,
          priority: 'Low',
          brand: 'BrandX',
          requestor: { requestorId: validRequestorId },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.bmPurchaseMaterials(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalled();
    });

    it('should return 500 if create fails', async () => {
      mockFindOne.mockResolvedValue(null);
      mockCreate.mockImplementation(() => ({
        then() {
          return {
            catch(callback) {
              callback(new Error('create failed'));
            },
          };
        },
      }));

      const req = {
        body: {
          primaryId: validProjectId,
          secondaryId: validMatTypeId,
          quantity: 50,
          priority: 'Low',
          brand: 'BrandX',
          requestor: { requestorId: validRequestorId },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.bmPurchaseMaterials(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should return 500 if update fails', async () => {
      mockFindOne.mockResolvedValue({ _id: '507f1f77bcf86cd799439014' });
      mockFindOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockReturnValue({
          then() {
            return {
              catch(callback) {
                callback(new Error('update failed'));
              },
            };
          },
        }),
      });

      const req = {
        body: {
          primaryId: validProjectId,
          secondaryId: validMatTypeId,
          quantity: 50,
          priority: 'Low',
          brand: 'BrandX',
          requestor: { requestorId: validRequestorId },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.bmPurchaseMaterials(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(expect.any(Error));
    });

    describe('validatePurchaseMaterialsBody branches', () => {
      const baseBody = {
        primaryId: validProjectId,
        secondaryId: validMatTypeId,
        quantity: 50,
        priority: 'Low',
        brand: 'BrandX',
        requestor: { requestorId: validRequestorId },
      };

      const makeRes = () => ({
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn().mockReturnThis(),
      });

      it.each([
        [
          'missing primaryId',
          { ...baseBody, primaryId: undefined },
          { message: 'Project is required', field: 'projectId' },
        ],
        [
          'missing secondaryId',
          { ...baseBody, secondaryId: undefined },
          { message: 'Material is required', field: 'matTypeId' },
        ],
        [
          'missing quantity',
          { ...baseBody, quantity: undefined },
          { message: 'Quantity is required', field: 'quantity' },
        ],
        [
          'missing priority',
          { ...baseBody, priority: undefined },
          { message: 'Priority is required', field: 'priority' },
        ],
        [
          'missing requestorId',
          { ...baseBody, requestor: {} },
          { message: 'Requestor information is required', field: 'requestorId' },
        ],
        [
          'invalid projectId format',
          { ...baseBody, primaryId: 'not-valid' },
          { message: 'Invalid project ID format', field: 'projectId' },
        ],
        [
          'invalid matTypeId format',
          { ...baseBody, secondaryId: 'not-valid' },
          { message: 'Invalid material ID format', field: 'matTypeId' },
        ],
        [
          'invalid requestorId format',
          { ...baseBody, requestor: { requestorId: 'not-valid' } },
          { message: 'Invalid requestor ID format', field: 'requestorId' },
        ],
        [
          'non-numeric quantity',
          { ...baseBody, quantity: 'abc' },
          { message: 'Quantity must be a valid number', field: 'quantity' },
        ],
        [
          'zero-or-negative quantity',
          { ...baseBody, quantity: -5 },
          { message: 'Quantity must be greater than 0', field: 'quantity' },
        ],
        [
          'invalid priority value',
          { ...baseBody, priority: 'Urgent' },
          { message: 'Priority must be one of: Low, Medium, High', field: 'priority' },
        ],
      ])('should return 400 for %s', async (_desc, body, expected) => {
        const req = { body };
        const res = makeRes();

        await controller.bmPurchaseMaterials(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining(expected));
        expect(mockFindOne).not.toHaveBeenCalled();
      });

      it('should accept a quantity of exactly 0 as provided (not "missing")', async () => {
        mockFindOne.mockResolvedValue(null);
        mockCreate.mockImplementation(() => ({
          then(callback) {
            callback();
            return { catch: jest.fn() };
          },
        }));

        const req = { body: { ...baseBody, quantity: 0 } };
        const res = makeRes();

        await controller.bmPurchaseMaterials(req, res);

        // quantity=0 passes the "required" check but fails the "greater than 0" check
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Quantity must be greater than 0',
            field: 'quantity',
          }),
        );
      });
    });
  });

  describe('bmPostMaterialUpdateRecord', () => {
    const validMaterialId = '507f1f77bcf86cd799439011';

    it('should update material stock and add update record', async () => {
      mockUpdateOne.mockReturnValue({
        then(callback) {
          callback({ nModified: 1 });
          return { catch: jest.fn() };
        },
      });

      const material = {
        _id: validMaterialId,
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

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: expect.any(mongoose.Types.ObjectId) },
        expect.any(Object),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalled();
    });

    it('should return 400 for invalid material._id', async () => {
      const req = {
        body: {
          material: {
            _id: 'not-valid-objectid',
            stockAvailable: 100,
            stockUsed: 0,
            stockWasted: 0,
          },
          quantityUsed: 5,
          quantityWasted: 0,
          QtyUsedLogUnit: 'unit',
          QtyWastedLogUnit: 'unit',
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn().mockReturnThis(),
      };
      await controller.bmPostMaterialUpdateRecord(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid material ID format', field: 'material._id' }),
      );
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('should reject if stock quantities exceed available', async () => {
      const material = {
        _id: validMaterialId,
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

    it('should convert percent-based quantityUsed and quantityWasted to actual values', async () => {
      mockUpdateOne.mockReturnValue({
        then(callback) {
          callback({ nModified: 1 });
          return { catch: jest.fn() };
        },
      });

      const material = {
        _id: validMaterialId,
        stockAvailable: 100,
        stockUsed: 0,
        stockWasted: 0,
      };

      const req = {
        body: {
          material,
          quantityUsed: 10, // 10% of 100 = 10
          quantityWasted: 5, // 5% of 100 = 5
          date: '2023-01-01',
          requestor: { requestorId: 'user123' },
          QtyUsedLogUnit: 'percent',
          QtyWastedLogUnit: 'percent',
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmPostMaterialUpdateRecord(req, res);

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: expect.any(mongoose.Types.ObjectId) },
        expect.objectContaining({
          $set: expect.objectContaining({
            stockUsed: 10,
            stockWasted: 5,
            stockAvailable: 85,
          }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 when updateOne fails', async () => {
      mockUpdateOne.mockReturnValue({
        then() {
          return {
            catch(callback) {
              callback(new Error('update failed'));
            },
          };
        },
      });

      const material = {
        _id: validMaterialId,
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

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ message: expect.any(Error) });
    });
  });

  describe('bmPostMaterialUpdateBulk', () => {
    const validMaterialId1 = '507f1f77bcf86cd799439021';
    const validMaterialId2 = '507f1f77bcf86cd799439022';

    it('should update multiple materials successfully', async () => {
      mockUpdateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ nModified: 1 }) });

      const req = {
        body: {
          upadateMaterials: [
            {
              material: {
                _id: validMaterialId1,
                stockAvailable: 100,
                stockUsed: 0,
                stockWasted: 0,
              },
              quantityUsed: 10,
              quantityWasted: 5,
              QtyUsedLogUnit: 'unit',
              QtyWastedLogUnit: 'unit',
              date: '2023-01-01',
            },
            {
              material: { _id: validMaterialId2, stockAvailable: 50, stockUsed: 0, stockWasted: 0 },
              quantityUsed: 5,
              quantityWasted: 0,
              QtyUsedLogUnit: 'unit',
              QtyWastedLogUnit: 'unit',
              date: '2023-01-01',
            },
          ],
          requestor: { requestorId: 'user123' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn(),
      };

      await controller.bmPostMaterialUpdateBulk(req, res);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockUpdateOne).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ result: expect.stringContaining('2 Material records') }),
      );
    });

    it('should return 500 when resulting stock available would be negative', async () => {
      const req = {
        body: {
          upadateMaterials: [
            {
              material: { _id: validMaterialId1, stockAvailable: 10, stockUsed: 0, stockWasted: 0 },
              quantityUsed: 20,
              quantityWasted: 0,
              QtyUsedLogUnit: 'unit',
              QtyWastedLogUnit: 'unit',
              date: '2023-01-01',
            },
          ],
          requestor: { requestorId: 'user123' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn(),
      };

      await controller.bmPostMaterialUpdateBulk(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Stock quantities submitted seems to be invalid');
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('should return 500 when a material._id is not a valid ObjectId', async () => {
      const req = {
        body: {
          upadateMaterials: [
            {
              material: {
                _id: 'not-a-valid-objectid',
                stockAvailable: 100,
                stockUsed: 0,
                stockWasted: 0,
              },
              quantityUsed: 10,
              quantityWasted: 0,
              QtyUsedLogUnit: 'unit',
              QtyWastedLogUnit: 'unit',
              date: '2023-01-01',
            },
          ],
          requestor: { requestorId: 'user123' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn(),
      };

      await controller.bmPostMaterialUpdateBulk(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Stock quantities submitted seems to be invalid');
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('should return 500 when one of the bulk updates fails', async () => {
      mockUpdateOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('bulk update failed')),
      });

      const req = {
        body: {
          upadateMaterials: [
            {
              material: {
                _id: validMaterialId1,
                stockAvailable: 100,
                stockUsed: 0,
                stockWasted: 0,
              },
              quantityUsed: 10,
              quantityWasted: 0,
              QtyUsedLogUnit: 'unit',
              QtyWastedLogUnit: 'unit',
              date: '2023-01-01',
            },
          ],
          requestor: { requestorId: 'user123' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn(),
      };

      await controller.bmPostMaterialUpdateBulk(req, res);
      await Promise.resolve();
      await Promise.resolve();

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(expect.any(Error));
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

    it('should return 400 if purchaseId is invalid', async () => {
      const req = {
        body: {
          purchaseId: 'not-a-valid-objectid',
          status: 'Approved',
          quantity: 30,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.bmupdatePurchaseStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid purchase ID format',
          field: 'purchaseId',
        }),
      );
      expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('should return 404 if purchase not found', async () => {
      const validPurchaseId = '507f1f77bcf86cd799439099';
      mockFindOne.mockResolvedValue(null);

      const req = {
        body: {
          purchaseId: validPurchaseId,
          status: 'Approved',
          quantity: 30,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmupdatePurchaseStatus(req, res);

      expect(mockFindOne).toHaveBeenCalledWith({
        'purchaseRecord._id': expect.any(mongoose.Types.ObjectId),
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Purchase not found');
    });

    it('should reject if purchase is not in Pending status', async () => {
      const validPurchaseId = '507f1f77bcf86cd7994390aa';
      const mockMaterial = {
        purchaseRecord: [{ _id: validPurchaseId, status: 'Approved' }],
      };

      mockFindOne.mockResolvedValue(mockMaterial);

      const req = {
        body: {
          purchaseId: validPurchaseId,
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

    it('should return 404 if the purchase record is missing from the material', async () => {
      const validPurchaseId = '507f1f77bcf86cd799439abc';
      const mockMaterial = {
        purchaseRecord: [{ _id: 'some-other-id', status: 'Pending' }],
      };
      mockFindOne.mockResolvedValue(mockMaterial);

      const req = {
        body: {
          purchaseId: validPurchaseId,
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
      expect(res.send).toHaveBeenCalledWith('Purchase record not found');
    });

    it('should approve a purchase, increment stockBought, and return 200', async () => {
      const validPurchaseId = '507f1f77bcf86cd799439abd';
      const mockMaterial = {
        purchaseRecord: [{ _id: validPurchaseId, status: 'Pending' }],
      };
      mockFindOne.mockResolvedValue(mockMaterial);
      mockFindOneAndUpdate.mockResolvedValue({ status: 'Approved' });

      const req = {
        body: {
          purchaseId: validPurchaseId,
          status: 'Approved',
          quantity: 30,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmupdatePurchaseStatus(req, res);

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { 'purchaseRecord._id': expect.any(mongoose.Types.ObjectId) },
        {
          $set: { 'purchaseRecord.$.status': 'Approved' },
          $inc: { stockBought: 30 },
        },
        { new: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('Purchase approved successfully');
    });

    it('should reject a purchase without incrementing stockBought', async () => {
      const validPurchaseId = '507f1f77bcf86cd799439abe';
      const mockMaterial = {
        purchaseRecord: [{ _id: validPurchaseId, status: 'Pending' }],
      };
      mockFindOne.mockResolvedValue(mockMaterial);
      mockFindOneAndUpdate.mockResolvedValue({ status: 'Rejected' });

      const req = {
        body: {
          purchaseId: validPurchaseId,
          status: 'Rejected',
          quantity: 30,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmupdatePurchaseStatus(req, res);

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { 'purchaseRecord._id': expect.any(mongoose.Types.ObjectId) },
        { $set: { 'purchaseRecord.$.status': 'Rejected' } },
        { new: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('Purchase rejected successfully');
    });

    it('should return 500 when findOneAndUpdate fails to apply the update', async () => {
      const validPurchaseId = '507f1f77bcf86cd799439abf';
      const mockMaterial = {
        purchaseRecord: [{ _id: validPurchaseId, status: 'Pending' }],
      };
      mockFindOne.mockResolvedValue(mockMaterial);
      mockFindOneAndUpdate.mockResolvedValue(null);

      const req = {
        body: {
          purchaseId: validPurchaseId,
          status: 'Approved',
          quantity: 30,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmupdatePurchaseStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Failed to apply purchase status update to material.');
    });

    it('should return 500 on an unexpected error', async () => {
      const validPurchaseId = '507f1f77bcf86cd799439ac0';
      mockFindOne.mockRejectedValue(new Error('Database error'));

      const req = {
        body: {
          purchaseId: validPurchaseId,
          status: 'Approved',
          quantity: 30,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmupdatePurchaseStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('bmGetMaterialCostCorrelation', () => {
    let mockReq;
    let mockRes;
    const FIXED_NOW = new Date('2024-01-15T12:30:45.123Z');
    const DEFAULT_DATE_QUERY = { startDate: '2024-01-01', endDate: '2024-01-31' };

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
        mockReq.query = { ...DEFAULT_DATE_QUERY };

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
        mockReq.query = { ...DEFAULT_DATE_QUERY };

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

        mockReq.query = { startDate: 'invalid-date', endDate: '2024-01-31' };

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

        mockReq.query = { startDate: '2024-01-01', endDate: 'invalid-date' };

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

        mockReq.query = { startDate: '2024-01-31', endDate: '2024-01-01' };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: error.message });
      });

      it('should return 400 for a date range error with an unrecognized type', async () => {
        const error = {
          type: 'SOME_OTHER_ERROR_TYPE',
          message: 'Unrecognized date error',
        };
        mockParseAndNormalizeDateRangeUTC.mockImplementationOnce(() => {
          throw error;
        });

        mockReq.query = { startDate: '2024-01-01', endDate: '2024-01-31' };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: error.message });
      });
    });

    describe('Category 4: Aggregation Errors', () => {
      it('should return 500 when aggregateMaterialUsage fails', async () => {
        const error = new Error('Database error');
        mockAggregateMaterialUsage.mockRejectedValueOnce(error);

        mockReq.query = { ...DEFAULT_DATE_QUERY };

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

        mockReq.query = { ...DEFAULT_DATE_QUERY };

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

        mockReq.query = { ...DEFAULT_DATE_QUERY };

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

    describe('Category 11: Name-based query parameter resolution', () => {
      it('should resolve projectName to project IDs and merge with projectId', async () => {
        mockParseMultiSelectQueryParam.mockImplementation((req, param) => {
          if (param === 'projectId') return ['507f1f77bcf86cd799439011'];
          if (param === 'projectName') return ['Project One'];
          return [];
        });
        mockResolveProjectNamesToIds.mockResolvedValueOnce(['507f1f77bcf86cd799439099']);

        mockReq.query = {
          projectName: 'Project One',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockResolveProjectNamesToIds).toHaveBeenCalledWith(
          ['Project One'],
          expect.any(Object),
        );
        expect(mockAggregateMaterialUsage).toHaveBeenCalledWith(
          BuildingMaterial,
          expect.objectContaining({
            projectIds: expect.arrayContaining([
              '507f1f77bcf86cd799439011',
              '507f1f77bcf86cd799439099',
            ]),
          }),
          expect.any(Object),
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should resolve materialName to material type IDs and merge with materialType', async () => {
        mockParseMultiSelectQueryParam.mockImplementation((req, param) => {
          if (param === 'materialType') return ['507f1f77bcf86cd799439012'];
          if (param === 'materialName') return ['Cement'];
          return [];
        });
        mockResolveMaterialNamesToIds.mockResolvedValueOnce(['507f1f77bcf86cd799439098']);

        mockReq.query = {
          materialName: 'Cement',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockResolveMaterialNamesToIds).toHaveBeenCalledWith(['Cement'], expect.any(Object));
        expect(mockAggregateMaterialUsage).toHaveBeenCalledWith(
          BuildingMaterial,
          expect.objectContaining({
            materialTypeIds: expect.arrayContaining([
              '507f1f77bcf86cd799439012',
              '507f1f77bcf86cd799439098',
            ]),
          }),
          expect.any(Object),
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should return 400 when projectName resolution throws a NAME_RESOLUTION_ERROR', async () => {
        mockParseMultiSelectQueryParam.mockImplementation((req, param) => {
          if (param === 'projectName') return ['Unknown Project'];
          return [];
        });
        const error = {
          type: 'NAME_RESOLUTION_ERROR',
          message: 'Could not resolve project name(s)',
        };
        mockResolveProjectNamesToIds.mockRejectedValueOnce(error);

        mockReq.query = { projectName: 'Unknown Project' };

        await controller.bmGetMaterialCostCorrelation(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: error.message });
        expect(mockLogException).not.toHaveBeenCalled();
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

  describe('bmGetMaterialSummaryByProject', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
      mockLogException.mockClear();
      mockReq = {
        params: { projectId: '507f1f77bcf86cd799439011' },
        query: {},
        method: 'GET',
        path: '/api/bmdashboard/materials/summary/507f1f77bcf86cd799439011',
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return 400 for an invalid projectId', async () => {
      mockReq.params.projectId = 'invalid-id';

      await controller.bmGetMaterialSummaryByProject(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid projectId' });
      expect(mockFind).not.toHaveBeenCalled();
    });

    it('should return 400 for an invalid materialType', async () => {
      mockReq.query.materialType = 'invalid-material-id';

      await controller.bmGetMaterialSummaryByProject(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid materialId' });
    });

    it('should aggregate available, used, and wasted materials', async () => {
      mockFind.mockResolvedValueOnce([
        { stockAvailable: 10, stockUsed: 5, stockWasted: 1, updateRecord: [] },
        { stockAvailable: 20, stockUsed: 15, stockWasted: 2, updateRecord: [] },
      ]);

      await controller.bmGetMaterialSummaryByProject(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        availableMaterials: 30,
        usedMaterials: 20,
        wastedMaterials: 3,
        increaseOverLastWeek: 0,
      });
    });

    it('should filter by materialType when a valid materialType is provided', async () => {
      mockReq.query.materialType = '507f1f77bcf86cd799439099';
      mockFind.mockResolvedValueOnce([]);

      await controller.bmGetMaterialSummaryByProject(mockReq, mockRes);

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          itemType: expect.any(mongoose.Types.ObjectId),
        }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should calculate a positive usage increase percentage week-over-week', async () => {
      const now = new Date();
      const thisWeekDate = new Date(now);
      thisWeekDate.setDate(now.getDate() - 1);
      const lastWeekDate = new Date(now);
      lastWeekDate.setDate(now.getDate() - 10);

      mockFind.mockResolvedValueOnce([
        {
          stockAvailable: 5,
          stockUsed: 30,
          stockWasted: 0,
          updateRecord: [
            { date: thisWeekDate, quantityUsed: 20 },
            { date: lastWeekDate, quantityUsed: 10 },
          ],
        },
      ]);

      await controller.bmGetMaterialSummaryByProject(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const [[response]] = mockRes.json.mock.calls;
      expect(response.increaseOverLastWeek).toBe(100);
    });

    it('should filter to only materials with increased usage when increaseOverLastWeek=true', async () => {
      mockReq.query.increaseOverLastWeek = 'true';
      const now = new Date();
      const thisWeekDate = new Date(now);
      thisWeekDate.setDate(now.getDate() - 1);
      const lastWeekDate = new Date(now);
      lastWeekDate.setDate(now.getDate() - 10);

      mockFind.mockResolvedValueOnce([
        {
          stockAvailable: 5,
          stockUsed: 20,
          stockWasted: 0,
          updateRecord: [{ date: thisWeekDate, quantityUsed: 20 }],
        },
        {
          stockAvailable: 5,
          stockUsed: 5,
          stockWasted: 0,
          updateRecord: [{ date: lastWeekDate, quantityUsed: 20 }],
        },
      ]);

      await controller.bmGetMaterialSummaryByProject(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const [[response]] = mockRes.json.mock.calls;
      expect(response.availableMaterials).toBe(5);
      expect(response.usedMaterials).toBe(20);
    });

    it('should log and return 500 on database error', async () => {
      const error = new Error('Database error');
      mockFind.mockRejectedValueOnce(error);

      await controller.bmGetMaterialSummaryByProject(mockReq, mockRes);

      expect(mockLogException).toHaveBeenCalledWith(
        error,
        'bmGetMaterialSummaryByProject',
        expect.objectContaining({
          method: mockReq.method,
          path: mockReq.path,
          params: mockReq.params,
          query: mockReq.query,
        }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('bmGetMaterialStockOutRisk', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
      mockReq = { query: {} };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return 400 when project IDs are provided but all invalid', async () => {
      mockReq.query.projectIds = 'not-valid-1,not-valid-2';

      await controller.bmGetMaterialStockOutRisk(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid project IDs provided',
        details: 'All provided project IDs are invalid',
      });
      expect(mockFind).not.toHaveBeenCalled();
    });

    it('should query without a project filter when projectIds is "all"', async () => {
      mockReq.query.projectIds = 'all';
      mockExec.mockResolvedValueOnce([]);

      await controller.bmGetMaterialStockOutRisk(mockReq, mockRes);

      expect(mockFind).toHaveBeenCalledWith({});
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should filter by valid project IDs', async () => {
      mockReq.query.projectIds = '507f1f77bcf86cd799439011';
      mockExec.mockResolvedValueOnce([]);

      await controller.bmGetMaterialStockOutRisk(mockReq, mockRes);

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          project: { $in: [expect.any(mongoose.Types.ObjectId)] },
        }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should skip materials missing project or itemType references', async () => {
      mockExec.mockResolvedValueOnce([
        { stockAvailable: 10, project: null, itemType: { _id: 'x' } },
        { stockAvailable: 10, project: { _id: 'p1' }, itemType: null },
        { stockAvailable: 0, project: { _id: 'p1' }, itemType: { _id: 'x' } },
      ]);

      await controller.bmGetMaterialStockOutRisk(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should compute usage-based days until stock out and sort ascending', async () => {
      const now = new Date();
      const recentDate = new Date(now);
      recentDate.setDate(now.getDate() - 5);

      mockExec.mockResolvedValueOnce([
        {
          stockAvailable: 300,
          stockUsed: 0,
          project: { _id: 'p1', name: 'Project One' },
          itemType: { _id: 'm1', name: 'Cement', unit: 'bags' },
          updateRecord: [{ date: recentDate, quantityUsed: 30 }],
        },
        {
          stockAvailable: 10,
          stockUsed: 0,
          project: { _id: 'p2', name: 'Project Two' },
          itemType: { _id: 'm2', name: 'Sand', unit: 'kg' },
          updateRecord: [{ date: recentDate, quantityUsed: 30 }],
        },
      ]);

      await controller.bmGetMaterialStockOutRisk(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const [[result]] = mockRes.json.mock.calls;
      expect(result).toHaveLength(2);
      expect(result[0].materialId).toBe('m2');
      expect(result[1].materialId).toBe('m1');
      expect(result[0].daysUntilStockOut).toBeLessThan(result[1].daysUntilStockOut);
    });

    it('should fall back to stockUsed when there is no usage in updateRecord', async () => {
      mockExec.mockResolvedValueOnce([
        {
          stockAvailable: 30,
          stockUsed: 30,
          project: { _id: 'p1', name: 'Project One' },
          itemType: { _id: 'm1', name: 'Cement', unit: 'bags' },
          updateRecord: [],
        },
      ]);

      await controller.bmGetMaterialStockOutRisk(mockReq, mockRes);

      const [[result]] = mockRes.json.mock.calls;
      expect(result).toHaveLength(1);
      expect(result[0].averageDailyUsage).toBeGreaterThan(0);
    });

    it('should exclude materials with no usage data at all', async () => {
      mockExec.mockResolvedValueOnce([
        {
          stockAvailable: 30,
          stockUsed: 0,
          project: { _id: 'p1', name: 'Project One' },
          itemType: { _id: 'm1', name: 'Cement', unit: 'bags' },
          updateRecord: [],
        },
      ]);

      await controller.bmGetMaterialStockOutRisk(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should return 400 on CastError', async () => {
      const error = new Error('bad cast');
      error.name = 'CastError';
      mockExec.mockRejectedValueOnce(error);

      await controller.bmGetMaterialStockOutRisk(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid request parameters' });
    });

    it('should return 503 on MongoServerError', async () => {
      const error = new Error('mongo down');
      error.name = 'MongoServerError';
      mockExec.mockRejectedValueOnce(error);

      await controller.bmGetMaterialStockOutRisk(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
    });

    it('should return 500 on an unrecognized error', async () => {
      const error = new Error('unknown failure');
      mockExec.mockRejectedValueOnce(error);

      await controller.bmGetMaterialStockOutRisk(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });
});
