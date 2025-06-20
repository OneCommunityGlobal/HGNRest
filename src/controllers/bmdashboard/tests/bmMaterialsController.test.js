jest.mock('mongoose', () => ({
  Types: {
    ObjectId: jest.fn().mockImplementation((id) => id),
  },
  connect: jest.fn().mockResolvedValue({}),
  disconnect: jest.fn().mockResolvedValue({}),
  model: jest.fn().mockReturnValue({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
  }),
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const bmMaterialsController = require('../bmMaterialsController')(
  mongoose.model('BuildingMaterial'),
);

describe('bmMaterialsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bmMaterialsList', () => {
    const mockReq = {};
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return a list of materials when successful', async () => {
      const mockResults = [{ id: 1, name: 'Material 1' }];
      mongoose.model('BuildingMaterial').find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockResults),
      });

      await bmMaterialsController.bmMaterialsList(mockReq, mockRes);

      expect(mongoose.model('BuildingMaterial').find).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockResults);
    });

    it('should handle errors appropriately', async () => {
      const mockError = new Error('Database error');
      const mockExec = jest.fn().mockRejectedValue(mockError);
      const mockPopulate = jest.fn().mockReturnThis();

      mongoose.model('BuildingMaterial').find.mockReturnValue({
        populate: mockPopulate,
        exec: mockExec,
      });

      await bmMaterialsController.bmMaterialsList(mockReq, mockRes);

      await Promise.resolve();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(mockError);
    });
  });

  describe('bmPurchaseMaterials', () => {
    const mockReq = {
      body: {
        primaryId: 'projectId123',
        secondaryId: 'matTypeId123',
        quantity: 10,
        priority: 'High',
        brand: 'TestBrand',
        requestor: { requestorId: 'user123' },
      },
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    it('should create new material document when material does not exist', async () => {
      mongoose.model('BuildingMaterial').findOne.mockResolvedValue(null);
      mongoose.model('BuildingMaterial').create.mockResolvedValue({});

      await bmMaterialsController.bmPurchaseMaterials(mockReq, mockRes);

      expect(mongoose.model('BuildingMaterial').create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should update existing material document when material exists', async () => {
      mongoose.model('BuildingMaterial').findOne.mockResolvedValue({ _id: 'existingId123' });
      mongoose.model('BuildingMaterial').findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await bmMaterialsController.bmPurchaseMaterials(mockReq, mockRes);

      expect(mongoose.model('BuildingMaterial').findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'existingId123' },
        { $push: { purchaseRecord: expect.any(Object) } },
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should handle errors appropriately', async () => {
      const mockError = new Error('Database error');
      mongoose.model('BuildingMaterial').findOne.mockRejectedValue(mockError);

      await bmMaterialsController.bmPurchaseMaterials(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(mockError);
    });
  });

  describe('bmPostMaterialUpdateRecord', () => {
    const mockReq = {
      body: {
        quantityUsed: 5,
        quantityWasted: 2,
        material: {
          _id: 'material123',
          stockAvailable: 20,
          stockUsed: 10,
          stockWasted: 3,
        },
        QtyUsedLogUnit: 'units',
        QtyWastedLogUnit: 'units',
        requestor: { requestorId: 'user123' },
        date: new Date(),
      },
    };

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    it('should reject update if quantities exceed available stock', async () => {
      const invalidReq = {
        body: {
          ...mockReq.body,
          quantityUsed: 15,
          quantityWasted: 10,
        },
      };

      await bmMaterialsController.bmPostMaterialUpdateRecord(invalidReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('exceeds the total stock available'),
      );
    });

    it('should handle percentage-based updates correctly', async () => {
      const percentageReq = {
        body: {
          ...mockReq.body,
          quantityUsed: 50,
          quantityWasted: 10,
          QtyUsedLogUnit: 'percent',
          QtyWastedLogUnit: 'percent',
        },
      };

      mongoose.model('BuildingMaterial').updateOne.mockReturnValue({
        then: jest.fn().mockImplementation((cb) => {
          cb({});
          return {
            catch: jest.fn(),
          };
        }),
      });

      await bmMaterialsController.bmPostMaterialUpdateRecord(percentageReq, mockRes);

      expect(mongoose.model('BuildingMaterial').updateOne).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('bmPostMaterialUpdateBulk', () => {
    const mockReq = {
      body: {
        upadateMaterials: [
          {
            quantityUsed: 5,
            quantityWasted: 2,
            material: {
              _id: 'material123',
              stockAvailable: 10,
              stockUsed: 0,
              stockWasted: 0,
            },
          },
        ],
        requestor: { requestorId: 'user123' },
        date: new Date(),
      },
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should process valid bulk updates successfully', async () => {
      const updateResults = [{ nModified: 1 }];
      const mockExec = jest.fn().mockResolvedValue({ nModified: 1 });
      mongoose.model('BuildingMaterial').updateOne.mockReturnValue({
        exec: mockExec,
      });

      await bmMaterialsController.bmPostMaterialUpdateBulk(mockReq, mockRes);

      expect(mongoose.model('BuildingMaterial').updateOne).toHaveBeenCalledWith(
        { _id: 'material123' },
        {
          $set: {
            stockUsed: 5,
            stockWasted: 2,
            stockAvailable: 3,
          },
          $push: {
            updateRecord: {
              createdBy: 'user123',
              quantityUsed: 5,
              quantityWasted: 2,
              date: mockReq.body.date,
            },
          },
        },
      );

      await Promise.resolve();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        result: 'Successfully posted log for 1 Material records.',
      });
    });

    it('should reject updates if any material would have negative stock', async () => {
      const invalidReq = {
        body: {
          ...mockReq.body,
          upadateMaterials: [
            {
              ...mockReq.body.upadateMaterials[0],
              quantityUsed: 25,
            },
          ],
        },
      };

      await bmMaterialsController.bmPostMaterialUpdateBulk(invalidReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith('Stock quantities submitted seems to be invalid');
    });
  });

  describe('bmupdatePurchaseStatus', () => {
    const mockReq = {
      body: {
        purchaseId: 'purchase123',
        status: 'Approved',
        quantity: 10,
      },
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    it('should update purchase status when valid', async () => {
      const mockMaterial = {
        purchaseRecord: [
          {
            _id: { toString: () => 'purchase123' },
            status: 'Pending',
          },
        ],
      };

      mongoose.model('BuildingMaterial').findOne.mockResolvedValue(mockMaterial);
      mongoose.model('BuildingMaterial').findOneAndUpdate.mockResolvedValue({});

      await bmMaterialsController.bmupdatePurchaseStatus(mockReq, mockRes);

      expect(mongoose.model('BuildingMaterial').findOneAndUpdate).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should reject status update for non-pending purchases', async () => {
      const mockMaterial = {
        purchaseRecord: [
          {
            _id: { toString: () => 'purchase123' },
            status: 'Approved',
          },
        ],
      };

      mongoose.model('BuildingMaterial').findOne.mockResolvedValue(mockMaterial);

      await bmMaterialsController.bmupdatePurchaseStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining("Purchase status can only be updated from 'Pending'"),
      );
    });

    it('should handle non-existent purchase records', async () => {
      mongoose.model('BuildingMaterial').findOne.mockResolvedValue(null);

      await bmMaterialsController.bmupdatePurchaseStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith('Purchase not found');
    });
  });
});
