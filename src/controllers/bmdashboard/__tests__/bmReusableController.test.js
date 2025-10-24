const mongoose = require('mongoose');
const mockReusableType = {
  findById: jest.fn(),
};

// Mock the buildingInventoryType module
jest.mock('../../../models/bmdashboard/buildingInventoryType', () => ({
  reusableType: mockReusableType,
}));

// Mock mongoose ObjectId validation
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: {
      isValid: jest.fn().mockReturnValue(true),
    },
  },
}));

describe('bmReusableController', () => {
  let bmReusableController;
  let BuildingReusableMock;
  let req;
  let res;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create BuildingReusableMock with all required methods
    BuildingReusableMock = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
      updateOne: jest.fn().mockReturnValue({
        then: jest.fn().mockImplementation(function (callback) {
          callback({ acknowledged: true });
          return {
            catch: jest.fn(),
          };
        }),
      }),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(function () {
        return Promise.resolve([]);
      }),
    };

    // Don't create circular references in the mock
    const thenFn = function (callback) {
      return {
        catch: function (errorCallback) {
          // This is just a placeholder that will be overridden in tests
        },
      };
    };

    BuildingReusableMock.then = jest.fn().mockImplementation(thenFn);

    // Mock constructor behavior separately
    const originalModule = jest.requireActual('../bmReusableController');
    jest.spyOn(global, 'Function').mockImplementation(() => {
      return function MockConstructor(data) {
        this.save = jest.fn().mockResolvedValue({});
        Object.assign(this, data);
        return this;
      };
    });

    // We need to mock the constructor function
    const mockConstructor = function (data) {
      const instance = {
        save: jest.fn().mockResolvedValue({}),
        ...data,
      };
      return instance;
    };

    // Replace the normal require with a function that injects our mock
    jest.doMock('../bmReusableController', () => {
      return function (BuildingReusable) {
        // Return the original controller with our modified constructor
        if (!BuildingReusable) {
          BuildingReusable = mockConstructor;
        }
        return originalModule(BuildingReusable);
      };
    });

    bmReusableController = require('../bmReusableController')(BuildingReusableMock);

    // Mock request and response objects
    req = {
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
  });

  describe('fetchBMReusables', () => {
    it('should fetch all reusables and return 200 status on success', async () => {
      // Setup
      const mockReusables = [{ name: 'Reusable 1' }, { name: 'Reusable 2' }];

      BuildingReusableMock.exec.mockImplementation(() => Promise.resolve(mockReusables));

      // Execute
      await bmReusableController.fetchBMReusables(req, res);

      // Assert
      expect(BuildingReusableMock.find).toHaveBeenCalled();
      expect(BuildingReusableMock.populate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockReusables);
    });

    it('should return error if an exception is thrown', async () => {
      // Setup
      const error = new Error('Unexpected error');
      BuildingReusableMock.find.mockImplementation(() => {
        throw error;
      });

      // Execute
      await bmReusableController.fetchBMReusables(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith(error);
    });
  });

  describe('purchaseReusable', () => {
    beforeEach(() => {
      req.body = {
        primaryId: 'projectId123',
        secondaryId: 'itemTypeId456',
        quantity: 5,
        priority: 'Medium',
        brand: 'TestBrand',
        requestor: {
          requestorId: 'userId789',
        },
      };
    });

    it('should return 400 if itemType is not found', async () => {
      // Setup
      mockReusableType.findById.mockResolvedValue(null);

      // Execute
      await bmReusableController.purchaseReusable(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'ItemTypeId does not correspond to a valid reusable_type.',
      );
    });

    it('should return 400 if itemType is not a reusable_type', async () => {
      // Setup
      mockReusableType.findById.mockResolvedValue({ __t: 'not_reusable_type' });

      // Execute
      await bmReusableController.purchaseReusable(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'ItemTypeId does not correspond to a valid reusable_type.',
      );
    });

    it('should return 400 if priority is invalid', async () => {
      // Setup
      mockReusableType.findById.mockResolvedValue({ __t: 'reusable_type' });
      req.body.priority = 'InvalidPriority';

      // Execute
      await bmReusableController.purchaseReusable(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid priority. Must be one of: Low, Medium, High.');
    });

    it('should return 500 if an error occurs', async () => {
      // Setup
      const error = new Error('Database error');
      mockReusableType.findById.mockImplementation(() => {
        throw error;
      });

      // Execute
      await bmReusableController.purchaseReusable(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Internal Server Error');
    });
  });

  describe('bmPostReusableUpdateRecord', () => {
    beforeEach(() => {
      req.body = {
        reusable: {
          _id: 'reusableId123',
          stockAvailable: 100,
          stockBought: 50,
          stockDestroyed: 20,
        },
        quantityUsed: 10,
        quantityWasted: 5,
        QtyUsedLogUnit: 'absolute',
        QtyWastedLogUnit: 'absolute',
        date: '2024-03-14',
        requestor: {
          requestorId: 'userId789',
        },
      };
    });

    it('should return 500 if quantity exceeds available stock', () => {
      // Setup
      req.body.quantityUsed = 60;
      req.body.quantityWasted = 60;

      // Execute
      bmReusableController.bmPostReusableUpdateRecord(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        'Please check the used and wasted stock values. Either individual values or their sum exceeds the total stock available.',
      );
    });

    it('should convert percentages to absolute values correctly', () => {
      // Setup
      req.body.quantityUsed = 10; // 10% of 100 = 10
      req.body.QtyUsedLogUnit = 'percent';

      // Execute
      bmReusableController.bmPostReusableUpdateRecord(req, res);

      // Assert
      expect(BuildingReusableMock.updateOne).toHaveBeenCalled();

      // Check that the percentage was calculated correctly
      const updateCall = BuildingReusableMock.updateOne.mock.calls[0];
      expect(updateCall[1].$push.updateRecord.quantityUsed).toBe(10);
    });

    it('should update stock values correctly', () => {
      // Execute
      bmReusableController.bmPostReusableUpdateRecord(req, res);

      // Assert
      expect(BuildingReusableMock.updateOne).toHaveBeenCalled();

      const updateCall = BuildingReusableMock.updateOne.mock.calls[0];
      const setValues = updateCall[1].$set;

      expect(setValues.stockBought).toBe(60); // 50 + 10
      expect(setValues.stockDestroyed).toBe(25); // 20 + 5
      expect(setValues.stockAvailable).toBe(85); // 100 - 10 - 5
    });

    it('should return 200 with results on successful update', () => {
      // Setup
      const updateResult = { acknowledged: true, modifiedCount: 1 };
      BuildingReusableMock.updateOne.mockReturnValue({
        then: jest.fn().mockImplementation(function (callback) {
          callback(updateResult);
          return {
            catch: jest.fn(),
          };
        }),
      });

      // Execute
      bmReusableController.bmPostReusableUpdateRecord(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(updateResult);
    });

    it('should return 500 with error message on update failure', () => {
      // Setup
      const error = new Error('Update failed');
      BuildingReusableMock.updateOne.mockReturnValue({
        then: jest.fn().mockImplementation(function (callback) {
          return {
            catch: jest.fn().mockImplementation(function (errCallback) {
              errCallback(error);
            }),
          };
        }),
      });

      // Execute
      bmReusableController.bmPostReusableUpdateRecord(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ message: error });
    });
  });
});
