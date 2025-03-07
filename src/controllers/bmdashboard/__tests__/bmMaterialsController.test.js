const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bmMaterialsController = require('../bmMaterialsController');

// Mock mongoose models
const mockExec = jest.fn();
const mockThen = jest.fn().mockImplementation(function(callback) {
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
const BuildingMaterial = {
  find: mockFind,
  findOne: mockFindOne,
  create: mockCreate,
  findOneAndUpdate: mockFindOneAndUpdate,
  updateOne: mockUpdateOne,
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
      mockPopulate.mockImplementation(function() {
        return {
          populate: mockPopulate,
          exec: function() {
            return {
              then: function(callback) {
                callback(mockResults);
                return { catch: mockCatch };
              }
            };
          }
        };
      });

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
      mockThen.mockImplementation(function() {
        return { catch: function(callback) { callback(mockError); } };
      });

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
      mockCreate.mockImplementation(() => {
        return {
          then: function(callback) {
            callback();
            return { catch: jest.fn() };
          }
        };
      });

      const req = {
        body: {
          primaryId: 'project123',
          secondaryId: 'matType123',
          quantity: 50,
          priority: 'high',
          brand: 'BrandX',
          requestor: { requestorId: 'user123' },
        }
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
          then: jest.fn().mockImplementation(function(callback) {
            callback();
            return { catch: jest.fn() };
          })
        })
      });

      const req = {
        body: {
          primaryId: 'project123',
          secondaryId: 'matType123',
          quantity: 50,
          priority: 'high',
          brand: 'BrandX',
          requestor: { requestorId: 'user123' },
        }
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
        }
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
        then: function(callback) {
          callback({ nModified: 1 });
          return { catch: jest.fn() };
        }
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
        }
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
          quantityUsed: 15,  // More than available
          quantityWasted: 0,
          QtyUsedLogUnit: 'unit',
          QtyWastedLogUnit: 'unit',
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.bmPostMaterialUpdateRecord(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining("exceeds the total stock available"));
    });
  });
});
