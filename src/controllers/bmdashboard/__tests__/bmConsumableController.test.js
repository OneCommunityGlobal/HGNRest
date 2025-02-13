const mongoose = require('mongoose');
const bmConsumableController = require('../bmConsumableController');

mongoose.Types.ObjectId = jest.fn(id => id);

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
    it('should fetch all consumables successfully', async () => {
      const mockResult = [
        {
          project: { _id: '1', name: 'Project 1' },
          itemType: { _id: '1', name: 'Item 1', unit: 'kg' },
        },
      ];

      mockBuildingConsumable.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockReturnValue(Promise.resolve(mockResult))
      });

      await controller.fetchBMConsumables({}, mockResponse);

      expect(mockBuildingConsumable.find).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith(mockResult);
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
        purchaseRecord: [{
          quantity: 10,
          priority: 'high',
          brandPref: 'TestBrand',
          requestedBy: '789',
        }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });
});
