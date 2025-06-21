const bmMaterialsController = require('./bmMaterialsController');

jest.mock('mongoose', () => ({
  Types: {
    ObjectId: jest.fn((id) => id),
  },
}));

describe('bmMaterialsController', () => {
  let BuildingMaterialMock;
  let controller;
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    BuildingMaterialMock = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      then: jest.fn(),
      catch: jest.fn(),
    };

    controller = bmMaterialsController(BuildingMaterialMock);

    req = {
      body: {},
      params: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
  });

  describe('bmMaterialsList', () => {
    it('should fetch all materials successfully and return 200 status', async () => {
      const mockMaterials = [
        {
          _id: '1',
          name: 'Cement',
          project: { _id: 'proj1', name: 'Project A' },
          itemType: { _id: 'type1', name: 'Construction', unit: 'kg' },
        },
        {
          _id: '2',
          name: 'Steel',
          project: { _id: 'proj2', name: 'Project B' },
          itemType: { _id: 'type2', name: 'Metal', unit: 'tons' },
        },
      ];

      BuildingMaterialMock.exec.mockReturnValue({
        then: (callback) => {
          callback(mockMaterials);
          return { catch: jest.fn() };
        },
      });

      await controller.bmMaterialsList(req, res);

      expect(BuildingMaterialMock.find).toHaveBeenCalled();
      expect(BuildingMaterialMock.populate).toHaveBeenCalledWith([
        {
          path: 'project',
          select: '_id name',
        },
        {
          path: 'itemType',
          select: '_id name unit',
        },
        {
          path: 'updateRecord',
          populate: {
            path: 'createdBy',
            select: '_id firstName lastName email',
          },
        },
        {
          path: 'purchaseRecord',
          populate: {
            path: 'requestedBy',
            select: '_id firstName lastName email',
          },
        },
      ]);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockMaterials);
    });

    it('should handle database errors and return 500 status', async () => {
      const mockError = new Error('Database connection failed');
      
      BuildingMaterialMock.exec.mockReturnValue({
        then: () => ({
          catch: (callback) => callback(mockError),
        }),
      });

      await controller.bmMaterialsList(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(mockError);
    });
  });

  describe('bmPurchaseMaterials', () => {
    it('should create new material purchase record when material does not exist', async () => {
      const purchaseData = {
        primaryId: 'project123',
        secondaryId: 'materialType456',
        quantity: 100,
        priority: 'High',
        brand: 'Premium Brand',
        requestor: { requestorId: 'user789' },
      };

      req.body = purchaseData;
      BuildingMaterialMock.findOne.mockResolvedValue(null);
      BuildingMaterialMock.create.mockReturnValue({
        then: (callback) => {
          callback();
          return { catch: jest.fn() };
        },
      });

      await controller.bmPurchaseMaterials(req, res);

      expect(BuildingMaterialMock.findOne).toHaveBeenCalledWith({
        project: 'project123',
        itemType: 'materialType456',
      });
      expect(BuildingMaterialMock.create).toHaveBeenCalledWith({
        itemType: 'materialType456',
        project: 'project123',
        purchaseRecord: [{
          quantity: 100,
          priority: 'High',
          brandPref: 'Premium Brand',
          requestedBy: 'user789',
        }],
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalled();
    });

    it.skip('should update existing material with new purchase record', async () => {
      const purchaseData = {
        primaryId: 'project123',
        secondaryId: 'materialType456',
        quantity: 50,
        priority: 'Medium',
        brand: 'Standard Brand',
        requestor: { requestorId: 'user789' },
      };

      req.body = purchaseData;

      const existingMaterial = {
        _id: 'existingMaterial123',
        project: 'project123',
        itemType: 'materialType456',
        purchaseRecord: [{ _id: 'existingPurchase', quantity: 25 }],
      };
      BuildingMaterialMock.findOne.mockResolvedValue(existingMaterial);

      BuildingMaterialMock.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ _id: 'existingMaterial123' }),
      });

      await controller.bmPurchaseMaterials(req, res);

      expect(BuildingMaterialMock.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'existingMaterial123' },
        {
          $push: {
            purchaseRecord: {
              quantity: 50,
              priority: 'Medium',
              brandPref: 'Standard Brand',
              requestedBy: 'user789',
            },
          },
        }
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('bmPostMaterialUpdateRecord', () => {
    it('should update material stock with valid quantities', async () => {

        const updateData = {
        material: {
          _id: 'material123',
          stockAvailable: 100,
          stockUsed: 20,
          stockWasted: 5,
        },
        quantityUsed: 10,
        quantityWasted: 2,
        date: '2024-01-15',
        requestor: { requestorId: 'user456' },
        QtyUsedLogUnit: 'absolute',
        QtyWastedLogUnit: 'absolute',
      };

      req.body = updateData;

      const mockUpdateResult = { modifiedCount: 1 };
      BuildingMaterialMock.updateOne.mockResolvedValue(mockUpdateResult);

      await controller.bmPostMaterialUpdateRecord(req, res);

      expect(BuildingMaterialMock.updateOne).toHaveBeenCalledWith(
        { _id: 'material123' },
        {
          $set: {
            stockUsed: 30,
            stockWasted: 7,
            stockAvailable: 88,
          },
          $push: {
            updateRecord: {
              date: '2024-01-15',
              createdBy: 'user456',
              quantityUsed: 10,
              quantityWasted: 2,
            },
          },
        }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockUpdateResult);
    });

    it('should handle percentage-based quantity calculations correctly', async () => {
      const updateData = {
        material: {
          _id: 'material123',
          stockAvailable: 100,
          stockUsed: 20,
          stockWasted: 5,
        },
        quantityUsed: 25, 
        quantityWasted: 10,
        date: '2024-01-15',
        requestor: { requestorId: 'user456' },
        QtyUsedLogUnit: 'percent',
        QtyWastedLogUnit: 'percent',
      };

      req.body = updateData;

      const mockUpdateResult = { modifiedCount: 1 };
      BuildingMaterialMock.updateOne.mockResolvedValue(mockUpdateResult);

      await controller.bmPostMaterialUpdateRecord(req, res);

      expect(BuildingMaterialMock.updateOne).toHaveBeenCalledWith(
        { _id: 'material123' },
        {
          $set: {
            stockUsed: 45, 
            stockWasted: 15,
            stockAvailable: 65, 
          },
          $push: {
            updateRecord: {
              date: '2024-01-15',
              createdBy: 'user456',
              quantityUsed: 25,
              quantityWasted: 10,
            },
          },
        }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('bmPostMaterialUpdateBulk', () => {
    it.skip('should successfully update multiple materials in bulk', async () => {
      const bulkUpdateData = {
        upadateMaterials: [
          {
            material: {
              _id: 'material1',
              stockAvailable: 100,
              stockUsed: 20,
              stockWasted: 5,
            },
            quantityUsed: 10,
            quantityWasted: 2,
            QtyUsedLogUnit: 'absolute',
            QtyWastedLogUnit: 'absolute',
          },
          {
            material: {
              _id: 'material2',
              stockAvailable: 200,
              stockUsed: 40,
              stockWasted: 10,
            },
            quantityUsed: 20,
            quantityWasted: 5,
            QtyUsedLogUnit: 'absolute',
            QtyWastedLogUnit: 'absolute',
          },
        ],
        date: '2024-01-15',
        requestor: { requestorId: 'user456' },
      };

      req.body = bulkUpdateData;

      BuildingMaterialMock.updateOne.mockReturnValue({
        exec: () => Promise.resolve({ modifiedCount: 1 }),
      });

      await controller.bmPostMaterialUpdateBulk(req, res);

      expect(BuildingMaterialMock.updateOne).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        result: 'Successfully posted log for 2 Material records.',
      });
    });

    it('should return error when stock quantities are invalid', async () => {
      const bulkUpdateData = {
        upadateMaterials: [
          {
            material: {
              _id: 'material1',
              stockAvailable: 10,
              stockUsed: 5,
              stockWasted: 2,
            },
            quantityUsed: 10, 
            quantityWasted: 5,
            QtyUsedLogUnit: 'absolute',
            QtyWastedLogUnit: 'absolute',
          },
        ],
        date: '2024-01-15',
        requestor: { requestorId: 'user456' },
      };

      req.body = bulkUpdateData;

      await controller.bmPostMaterialUpdateBulk(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Stock quantities submitted seems to be invalid');
    });
  });

  describe('bmupdatePurchaseStatus', () => {
    it('should successfully update purchase status from Pending to Approved', async () => {

        const updateData = {
        purchaseId: 'purchase123',
        status: 'Approved',
        quantity: 100,
      };

      req.body = updateData;

      const mockMaterial = {
        _id: 'material123',
        purchaseRecord: [
          {
            _id: 'purchase123',
            status: 'Pending',
            quantity: 100,
          },
        ],
      };

      BuildingMaterialMock.findOne.mockResolvedValue(mockMaterial);
      BuildingMaterialMock.findOneAndUpdate.mockResolvedValue(mockMaterial);

      await controller.bmupdatePurchaseStatus(req, res);

      expect(BuildingMaterialMock.findOne).toHaveBeenCalledWith({
        'purchaseRecord._id': 'purchase123',
      });
      expect(BuildingMaterialMock.findOneAndUpdate).toHaveBeenCalledWith(
        { 'purchaseRecord._id': 'purchase123' },
        {
          $set: { 'purchaseRecord.$.status': 'Approved' },
          $inc: { stockBought: 100 },
        },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('Purchase approved successfully');
    });

    it('should return 404 when purchase is not found', async () => {
      const updateData = {
        purchaseId: 'nonexistentPurchase',
        status: 'Approved',
        quantity: 100,
      };

      req.body = updateData;

      BuildingMaterialMock.findOne.mockResolvedValue(null);

      await controller.bmupdatePurchaseStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Purchase not found');
    });

    it('should return 400 when trying to update non-Pending purchase', async () => {
      const updateData = {
        purchaseId: 'purchase123',
        status: 'Approved',
        quantity: 100,
      };

      req.body = updateData;

      const mockMaterial = {
        _id: 'material123',
        purchaseRecord: [
          {
            _id: 'purchase123',
            status: 'Approved', 
            quantity: 100,
          },
        ],
      };

      BuildingMaterialMock.findOne.mockResolvedValue(mockMaterial);

      await controller.bmupdatePurchaseStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        "Purchase status can only be updated from 'Pending'. Current status is 'Approved'."
      );
    });
  });
});
