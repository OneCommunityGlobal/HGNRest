const mongoose = require('mongoose');
// const { MongoMemoryServer } = require('mongodb-memory-server'); Commenting this because it's never used
const bmMaterialsController = require('../bmMaterialsController');

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
const mockUpdateMany = jest.fn();

// Mock BuildingMaterial model
const BuildingMaterial = {
  find: mockFind,
  findOne: mockFindOne,
  create: mockCreate,
  findOneAndUpdate: mockFindOneAndUpdate,
  updateOne: mockUpdateOne,
  updateMany: mockUpdateMany,
  populate: mockPopulate,
  exec: mockExec,
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
    // One test below stubs mongoose.Types.ObjectId; restore it so later suites
    // (e.g. bmApplyMaterialBulkAction) still have access to ObjectId.isValid.
    const realObjectId = mongoose.Types.ObjectId;
    afterEach(() => {
      mongoose.Types.ObjectId = realObjectId;
    });

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

  describe('bmApplyMaterialBulkAction', () => {
    const validIds = ['5f9d88b9c9d1c8b1a0e7e111', '5f9d88b9c9d1c8b1a0e7e222'];

    const makeRes = () => ({
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    });

    it('reports the modified count from a Mongoose 5 result (n/nModified)', async () => {
      mockUpdateMany.mockResolvedValue({ ok: 1, n: 2, nModified: 2 });

      const req = { body: { materialIds: validIds, action: 'hold' } };
      const res = makeRes();

      await controller.bmApplyMaterialBulkAction(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        matchedCount: 2,
        modifiedCount: 2,
        result: "Applied 'hold' to 2 material records.",
      });
      const [payload] = res.send.mock.calls[0];
      expect(payload.result).not.toContain('undefined');
    });

    it('reports the modified count from a newer driver result (matchedCount/modifiedCount)', async () => {
      mockUpdateMany.mockResolvedValue({ acknowledged: true, matchedCount: 2, modifiedCount: 1 });

      const req = { body: { materialIds: validIds, action: 'review' } };
      const res = makeRes();

      await controller.bmApplyMaterialBulkAction(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        matchedCount: 2,
        modifiedCount: 1,
        result: "Applied 'review' to 1 material records.",
      });
    });

    it('defaults the count to 0 instead of undefined when the driver omits it', async () => {
      mockUpdateMany.mockResolvedValue({ ok: 1 });

      const req = { body: { materialIds: validIds, action: 'hold' } };
      const res = makeRes();

      await controller.bmApplyMaterialBulkAction(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const [payload] = res.send.mock.calls[0];
      expect(payload.result).toBe("Applied 'hold' to 0 material records.");
      expect(payload.modifiedCount).toBe(0);
    });

    it('rejects an empty material id list', async () => {
      const req = { body: { materialIds: [], action: 'hold' } };
      const res = makeRes();

      await controller.bmApplyMaterialBulkAction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects an invalid bulk action', async () => {
      const req = { body: { materialIds: validIds, action: 'delete' } };
      const res = makeRes();

      await controller.bmApplyMaterialBulkAction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });
  });
});
