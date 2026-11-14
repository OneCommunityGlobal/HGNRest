const mongoose = require('mongoose');
const bmConsumableController = require('../bmConsumableController');

jest.mock('../../../models/bmdashboard/updateHistory', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

const flushPromises = () => new Promise(setImmediate);

mongoose.Types.ObjectId = jest.fn((id) => id);

const mockBuildingConsumable = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
};

const mockResponse = {
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
  json: jest.fn(),
};

const controller = bmConsumableController(mockBuildingConsumable);

describe('Building Consumable Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse.status.mockClear();
    mockResponse.send.mockClear();
    mockResponse.json.mockClear();
  });

  describe('fetchBMConsumables', () => {
    it('should return Available calculated as Bought - Used - Wasted', async () => {
      const mockResult = [
        {
          project: { _id: '1', name: 'Project 1' },
          itemType: { _id: '1', name: 'Item 1', unit: 'kg' },
          stockBought: 64,
          stockUsed: 4,
          stockWasted: 3,
          stockAvailable: 43, // stored value that has drifted
        },
        {
          project: { _id: '1', name: 'Project 1' },
          itemType: { _id: '2', name: 'Item 2', unit: 'kg' },
          stockBought: 13,
          stockUsed: 14,
          stockWasted: 0,
          stockAvailable: 49, // Used is more than Bought, so Available is negative
        },
      ];

      mockBuildingConsumable.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockReturnValue(Promise.resolve(mockResult)),
      });

      await controller.fetchBMConsumables({}, mockResponse);
      await flushPromises();

      expect(mockBuildingConsumable.find).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith([
        { ...mockResult[0], stockAvailable: 57 },
        { ...mockResult[1], stockAvailable: -1 },
      ]);
    });
  });

  describe('bmPurchaseConsumables', () => {
    const mockRequest = {
      body: {
        projectId: '123',
        consumableId: '456',
        quantity: 10,
        priority: 'high',
        brand: 'TestBrand',
        requestor: {
          requestorId: '789',
        },
      },
    };

    it('should create new consumable if none exists', async () => {
      mockBuildingConsumable.findOne.mockResolvedValue(null);
      mockBuildingConsumable.create.mockResolvedValue({});

      await controller.bmPurchaseConsumables(mockRequest, mockResponse);

      expect(mockBuildingConsumable.create).toHaveBeenCalledWith({
        itemType: '456',
        project: '123',
        purchaseRecord: [
          {
            quantity: 10,
            priority: 'high',
            brandPref: 'TestBrand',
            requestedBy: '789',
          },
        ],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should update existing consumable', async () => {
      const mockExistingDoc = {
        _id: 'existingId',
        project: '123',
        itemType: '456',
      };

      mockBuildingConsumable.findOne.mockResolvedValue(mockExistingDoc);
      mockBuildingConsumable.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await controller.bmPurchaseConsumables(mockRequest, mockResponse);

      expect(mockBuildingConsumable.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'existingId' },
        {
          $push: {
            purchaseRecord: {
              quantity: 10,
              priority: 'high',
              brandPref: 'TestBrand',
              requestedBy: '789',
            },
          },
        },
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });

  describe('bmPostConsumableUpdateRecord', () => {
    const mockRequest = {
      body: {
        quantityUsed: 10,
        quantityWasted: 5,
        qtyUsedLogUnit: 'units',
        qtyWastedLogUnit: 'units',
        stockAvailable: 100,
        consumable: {
          _id: '123',
          stockBought: 170,
          stockUsed: 50,
          stockWasted: 20,
        },
        date: '2025-02-13',
        requestor: {
          requestorId: '789',
        },
      },
    };

    it('should update consumable records successfully', async () => {
      mockBuildingConsumable.updateOne.mockResolvedValue({});

      await controller.bmPostConsumableUpdateRecord(mockRequest, mockResponse);
      await flushPromises();

      expect(mockBuildingConsumable.updateOne).toHaveBeenCalledWith(
        { _id: '123' },
        {
          $set: {
            stockUsed: 60,
            stockWasted: 25,
            stockAvailable: 85, // 170 bought - 60 used - 25 wasted
          },
          $push: {
            updateRecord: {
              date: '2025-02-13',
              createdBy: '789',
              quantityUsed: 10,
              quantityWasted: 5,
            },
          },
        },
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle percentage calculations correctly', async () => {
      const percentRequest = {
        body: {
          ...mockRequest.body,
          quantityUsed: 10,
          quantityWasted: 5,
          qtyUsedLogUnit: 'percent',
          qtyWastedLogUnit: 'percent',
        },
      };

      mockBuildingConsumable.updateOne.mockResolvedValue({});

      await controller.bmPostConsumableUpdateRecord(percentRequest, mockResponse);
      await flushPromises();

      const expectedUsed = 10; // 10% of 100
      const expectedWasted = 5; // 5% of 100
      const newStockUsed = 50 + expectedUsed;
      const newStockWasted = 20 + expectedWasted;
      const newAvailable = 170 - newStockUsed - newStockWasted; // Bought - Used - Wasted

      expect(mockBuildingConsumable.updateOne).toHaveBeenCalledWith(
        { _id: '123' },
        {
          $set: {
            stockUsed: newStockUsed,
            stockWasted: newStockWasted,
            stockAvailable: newAvailable,
          },
          $push: {
            updateRecord: {
              date: '2025-02-13',
              createdBy: '789',
              quantityUsed: expectedUsed,
              quantityWasted: expectedWasted,
            },
          },
        },
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should reject when quantities exceed available stock', async () => {
      const invalidRequest = {
        body: {
          ...mockRequest.body,
          quantityUsed: 60,
          quantityWasted: 50,
        },
      };

      await controller.bmPostConsumableUpdateRecord(invalidRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        message:
          'Please check the used and wasted stock values. Either individual values or their sum exceeds the total stock available.',
      });
    });

    it('should reject negative quantities', async () => {
      const negativeRequest = {
        body: {
          ...mockRequest.body,
          quantityUsed: -10,
          quantityWasted: 5,
        },
      };

      await controller.bmPostConsumableUpdateRecord(negativeRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        message: 'Please check the used and wasted stock values. Negative numbers are invalid.',
      });
    });
  });

  describe('bmUpdateConsumablePurchaseStatus', () => {
    it('should add an approved purchase to both Bought and Available', async () => {
      mockBuildingConsumable.findOne.mockResolvedValue({
        purchaseRecord: [{ _id: 'purchase1', status: 'Pending' }],
      });
      mockBuildingConsumable.findOneAndUpdate.mockResolvedValue({ _id: '123' });

      const request = {
        body: {
          purchaseId: 'purchase1',
          status: 'Approved',
          quantity: 10,
          requestor: { role: 'Owner' },
        },
      };

      await controller.bmUpdateConsumablePurchaseStatus(request, mockResponse);

      expect(mockBuildingConsumable.findOneAndUpdate).toHaveBeenCalledWith(
        { 'purchaseRecord._id': 'purchase1' },
        {
          $set: { 'purchaseRecord.$.status': 'Approved' },
          $inc: { stockBought: 10, stockAvailable: 10 },
        },
        { new: true },
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });
});
