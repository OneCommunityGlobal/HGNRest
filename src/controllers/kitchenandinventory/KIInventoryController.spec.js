jest.mock('../../models/kitchenandinventory/KIInventoryItems', () => {
  const mock = jest.fn();
  mock.find = jest.fn();
  mock.findById = jest.fn();
  mock.findByIdAndDelete = jest.fn();
  return mock;
});

const KIInventoryItem = require('../../models/kitchenandinventory/KIInventoryItems');
const KIInventoryController = require('./KIInventoryController');

const VALID_OID = '507f1f77bcf86cd799439011';

function makeReq(overrides = {}) {
  return {
    body: overrides.body || {},
    query: overrides.query || {},
    params: overrides.params || {},
  };
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('KIInventoryController', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = KIInventoryController();
  });

  describe('addItem', () => {
    test('successfully adds a new item', async () => {
      const itemData = {
        name: 'Apples',
        storedQuantity: 10,
        unit: 'lbs',
        type: 'fruit',
        monthlyUsage: 5,
        category: 'INGREDIENT',
        expiryDate: '2030-01-01',
      };
      const req = makeReq({ body: itemData });
      const res = makeRes();

      const saveMock = jest.fn().mockResolvedValue(itemData);
      KIInventoryItem.mockImplementation(() => ({
        save: saveMock,
      }));

      await controller.addItem(req, res);

      expect(saveMock).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Inventory item added successfully',
        data: expect.any(Object),
      });
    });

    test('returns 400 when save fails', async () => {
      const req = makeReq({ body: {} });
      const res = makeRes();

      KIInventoryItem.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('Save error')),
      }));

      await controller.addItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Save error' });
    });
  });

  describe('getItems', () => {
    test('successfully fetches all items', async () => {
      const mockItems = [{ name: 'Item 1' }, { name: 'Item 2' }];
      KIInventoryItem.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockItems),
      });

      const req = makeReq();
      const res = makeRes();

      await controller.getItems(req, res);

      expect(KIInventoryItem.find).toHaveBeenCalledWith(null, { __v: 0 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'All Items fetched successfully.',
        data: mockItems,
      });
    });

    test('returns 400 on error', async () => {
      KIInventoryItem.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const req = makeReq();
      const res = makeRes();

      await controller.getItems(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Something went wrong while fetching items.',
      });
    });
  });

  describe('getItemsByCategory', () => {
    test('successfully fetches items by category', async () => {
      const mockItems = [{ name: 'Ingredient 1', category: 'INGREDIENT' }];
      KIInventoryItem.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockItems),
      });

      const req = makeReq({ params: { category: 'INGREDIENT' } });
      const res = makeRes();

      await controller.getItemsByCategory(req, res);

      expect(KIInventoryItem.find).toHaveBeenCalledWith({ category: 'INGREDIENT' }, { __v: 0 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Items fetched successfully.',
        data: mockItems,
      });
    });

    test('returns 400 on error', async () => {
      KIInventoryItem.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const req = makeReq({ params: { category: 'INGREDIENT' } });
      const res = makeRes();

      await controller.getItemsByCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Something went wrong while fetching items.',
      });
    });
  });

  describe('getPreservedStock', () => {
    test('successfully fetches preserved items', async () => {
      const mockItems = [{ name: 'Honey', category: 'INGREDIENT' }];
      KIInventoryItem.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockItems),
      });

      const req = makeReq();
      const res = makeRes();

      await controller.getPreservedStock(req, res);

      expect(KIInventoryItem.find).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'INGREDIENT',
          expiryDate: expect.any(Object),
        }),
        { __v: 0 },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Preserved stock items fetched successfully.',
        data: mockItems,
      });
    });

    test('returns 400 on error', async () => {
      KIInventoryItem.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const req = makeReq();
      const res = makeRes();

      await controller.getPreservedStock(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Something went wrong while fetching preserved stock items.',
      });
    });
  });

  describe('updateOnUsage', () => {
    test('returns 400 if usedQuantity is 0 or negative', async () => {
      const req = makeReq({ body: { itemId: VALID_OID, usedQuantity: 0 } });
      const res = makeRes();

      await controller.updateOnUsage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Used quantity must be greater than zero.',
      });
    });

    test('returns 404 if item not found', async () => {
      KIInventoryItem.findById.mockResolvedValue(null);

      const req = makeReq({ body: { itemId: VALID_OID, usedQuantity: 5 } });
      const res = makeRes();

      await controller.updateOnUsage(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Item not found.' });
    });

    test('returns 400 if item is expired', async () => {
      const expiredItem = {
        expiryDate: new Date('2020-01-01'),
      };
      KIInventoryItem.findById.mockResolvedValue(expiredItem);

      const req = makeReq({ body: { itemId: VALID_OID, usedQuantity: 5 } });
      const res = makeRes();

      await controller.updateOnUsage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toContain('This item was expired on');
    });

    test('successfully updates usage when quantity is sufficient', async () => {
      const item = {
        presentQuantity: 10,
        expiryDate: new Date('2030-01-01'),
        save: jest.fn().mockResolvedValue(true),
      };
      KIInventoryItem.findById.mockResolvedValue(item);

      const req = makeReq({ body: { itemId: VALID_OID, usedQuantity: 3 } });
      const res = makeRes();

      await controller.updateOnUsage(req, res);

      expect(item.presentQuantity).toBe(7);
      expect(item.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Item usage updated successfully.',
        data: item,
      });
    });

    test('caps presentQuantity at 0 if usage exceeds available', async () => {
      const item = {
        presentQuantity: 5,
        expiryDate: new Date('2030-01-01'),
        save: jest.fn().mockResolvedValue(true),
      };
      KIInventoryItem.findById.mockResolvedValue(item);

      const req = makeReq({ body: { itemId: VALID_OID, usedQuantity: 10 } });
      const res = makeRes();

      await controller.updateOnUsage(req, res);

      expect(item.presentQuantity).toBe(0);
      expect(item.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('returns 400 on DB error', async () => {
      KIInventoryItem.findById.mockRejectedValue(new Error('DB Error'));

      const req = makeReq({ body: { itemId: VALID_OID, usedQuantity: 5 } });
      const res = makeRes();

      await controller.updateOnUsage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'DB Error' });
    });
  });

  describe('updateStoredQuantity', () => {
    test('returns 400 if addedQuantity <= 0', async () => {
      const req = makeReq({ body: { itemId: VALID_OID, addedQuantity: 0 } });
      const res = makeRes();

      await controller.updateStoredQuantity(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Added quantity must be greater than zero.',
      });
    });

    test('returns 400 if newExpiry is in the past', async () => {
      const req = makeReq({
        body: { itemId: VALID_OID, addedQuantity: 5, newExpiry: '2020-01-01' },
      });
      const res = makeRes();

      await controller.updateStoredQuantity(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'New expiry date must be a future date.',
      });
    });

    test('returns 404 if item not found', async () => {
      KIInventoryItem.findById.mockResolvedValue(null);

      const req = makeReq({ body: { itemId: VALID_OID, addedQuantity: 5 } });
      const res = makeRes();

      await controller.updateStoredQuantity(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Item not found.' });
    });

    test('resets quantity if current item is expired', async () => {
      const expiredItem = {
        storedQuantity: 10,
        presentQuantity: 5,
        expiryDate: new Date('2020-01-01'),
        save: jest.fn().mockResolvedValue(true),
      };
      KIInventoryItem.findById.mockResolvedValue(expiredItem);

      const req = makeReq({ body: { itemId: VALID_OID, addedQuantity: 15 } });
      const res = makeRes();

      await controller.updateStoredQuantity(req, res);

      expect(expiredItem.storedQuantity).toBe(15);
      expect(expiredItem.presentQuantity).toBe(15);
      expect(expiredItem.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('adds to existing quantity if item not expired', async () => {
      const validItem = {
        storedQuantity: 10,
        presentQuantity: 5,
        expiryDate: new Date('2030-01-01'),
        save: jest.fn().mockResolvedValue(true),
      };
      KIInventoryItem.findById.mockResolvedValue(validItem);

      const req = makeReq({
        body: { itemId: VALID_OID, addedQuantity: 15, newExpiry: '2031-01-01' },
      });
      const res = makeRes();

      await controller.updateStoredQuantity(req, res);

      expect(validItem.storedQuantity).toBe(25);
      expect(validItem.presentQuantity).toBe(20);
      expect(validItem.expiryDate).toBe('2031-01-01');
      expect(validItem.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('returns 400 on error', async () => {
      KIInventoryItem.findById.mockRejectedValue(new Error('DB Error'));

      const req = makeReq({ body: { itemId: VALID_OID, addedQuantity: 5 } });
      const res = makeRes();

      await controller.updateStoredQuantity(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'DB Error' });
    });
  });

  describe('updateNextHarvest', () => {
    test('returns 404 if item not found', async () => {
      KIInventoryItem.findById.mockResolvedValue(null);

      const req = makeReq({ body: { itemId: VALID_OID } });
      const res = makeRes();

      await controller.updateNextHarvest(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Item not found.' });
    });

    test('updates harvest details and copies next to last harvest if successful', async () => {
      const item = {
        nextHarvestDate: '2026-06-01',
        lastHarvestDate: null,
        save: jest.fn().mockResolvedValue(true),
      };
      KIInventoryItem.findById.mockResolvedValue(item);

      const req = makeReq({
        body: {
          itemId: VALID_OID,
          lastHarvestSuccess: true,
          nextHarvestDate: '2026-07-01',
          nextHarvestQuantity: 50,
        },
      });
      const res = makeRes();

      await controller.updateNextHarvest(req, res);

      expect(item.lastHarvestDate).toBe('2026-06-01');
      expect(item.nextHarvestDate).toBe('2026-07-01');
      expect(item.nextHarvestQuantity).toBe(50);
      expect(item.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('returns 400 on error', async () => {
      KIInventoryItem.findById.mockRejectedValue(new Error('DB Error'));

      const req = makeReq({ body: { itemId: VALID_OID } });
      const res = makeRes();

      await controller.updateNextHarvest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'DB Error' });
    });
  });

  describe('updateItem', () => {
    test('updates allowed fields and converts empty strings to undefined', async () => {
      const item = {
        name: 'Old Apples',
        type: 'fruit',
        unit: 'lbs',
        location: 'Pantry',
        category: 'INGREDIENT',
        onsite: true,
        presentQuantity: 8,
        storedQuantity: 12,
        reorderAt: 5,
        monthlyUsage: 3,
        expiryDate: '2030-01-01',
        lastHarvestDate: '2029-01-01',
        nextHarvestDate: '2030-02-01',
        nextHarvestQuantity: 10,
        save: jest.fn(),
      };
      item.save.mockResolvedValue(item);
      KIInventoryItem.findById.mockResolvedValue(item);

      const req = makeReq({
        params: { itemId: VALID_OID },
        body: {
          name: 'Fresh Apples',
          type: 'fresh fruit',
          unit: 'kg',
          location: '',
          category: 'INGREDIENT',
          onsite: false,
          presentQuantity: 10,
          storedQuantity: 20,
          reorderAt: 7,
          monthlyUsage: 4,
          expiryDate: '2031-01-01',
          lastHarvestDate: '',
          nextHarvestDate: '2031-02-01',
          nextHarvestQuantity: 15,
          ignoredField: 'do not save',
        },
      });
      const res = makeRes();

      await controller.updateItem(req, res);

      expect(KIInventoryItem.findById).toHaveBeenCalledWith(VALID_OID);
      expect(item.name).toBe('Fresh Apples');
      expect(item.type).toBe('fresh fruit');
      expect(item.unit).toBe('kg');
      expect(item.location).toBeUndefined();
      expect(item.category).toBe('INGREDIENT');
      expect(item.onsite).toBe(false);
      expect(item.presentQuantity).toBe(10);
      expect(item.storedQuantity).toBe(20);
      expect(item.reorderAt).toBe(7);
      expect(item.monthlyUsage).toBe(4);
      expect(item.expiryDate).toBe('2031-01-01');
      expect(item.lastHarvestDate).toBeUndefined();
      expect(item.nextHarvestDate).toBe('2031-02-01');
      expect(item.nextHarvestQuantity).toBe(15);
      expect(item.ignoredField).toBeUndefined();
      expect(item.updatedAt).toEqual(expect.any(Date));
      expect(item.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Inventory item updated successfully.',
        data: item,
      });
    });

    test('returns 404 if item not found', async () => {
      KIInventoryItem.findById.mockResolvedValue(null);

      const req = makeReq({ params: { itemId: VALID_OID }, body: { name: 'Missing Item' } });
      const res = makeRes();

      await controller.updateItem(req, res);

      expect(KIInventoryItem.findById).toHaveBeenCalledWith(VALID_OID);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Item not found.' });
    });

    test('returns 400 when stored quantity is less than present quantity', async () => {
      const item = {
        storedQuantity: 10,
        presentQuantity: 5,
        save: jest.fn(),
      };
      KIInventoryItem.findById.mockResolvedValue(item);

      const req = makeReq({
        params: { itemId: VALID_OID },
        body: { storedQuantity: 8, presentQuantity: 9 },
      });
      const res = makeRes();

      await controller.updateItem(req, res);

      expect(item.save).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Stored quantity must be greater than or equal to current stock.',
      });
    });

    test('returns 400 on save error', async () => {
      const item = {
        storedQuantity: 10,
        presentQuantity: 5,
        save: jest.fn().mockRejectedValue(new Error('Save Error')),
      };
      KIInventoryItem.findById.mockResolvedValue(item);

      const req = makeReq({ params: { itemId: VALID_OID }, body: { name: 'Fresh Apples' } });
      const res = makeRes();

      await controller.updateItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Save Error' });
    });
  });

  describe('deleteItem', () => {
    test('successfully deletes an item', async () => {
      const deletedItem = { _id: VALID_OID, name: 'Apples' };
      KIInventoryItem.findByIdAndDelete.mockResolvedValue(deletedItem);

      const req = makeReq({ params: { itemId: VALID_OID } });
      const res = makeRes();

      await controller.deleteItem(req, res);

      expect(KIInventoryItem.findByIdAndDelete).toHaveBeenCalledWith(VALID_OID);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Inventory item deleted successfully.',
        data: deletedItem,
      });
    });

    test('returns 404 if item not found', async () => {
      KIInventoryItem.findByIdAndDelete.mockResolvedValue(null);

      const req = makeReq({ params: { itemId: VALID_OID } });
      const res = makeRes();

      await controller.deleteItem(req, res);

      expect(KIInventoryItem.findByIdAndDelete).toHaveBeenCalledWith(VALID_OID);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Item not found.' });
    });

    test('returns 400 on DB error', async () => {
      KIInventoryItem.findByIdAndDelete.mockRejectedValue(new Error('DB Error'));

      const req = makeReq({ params: { itemId: VALID_OID } });
      const res = makeRes();

      await controller.deleteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'DB Error' });
    });
  });

  describe('getInventoryStats', () => {
    test('successfully returns calculated stats including preserved stock', async () => {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 2);

      const mockItems = [
        { presentQuantity: 12, reorderAt: 20, category: 'INGREDIENT', expiryDate: farFuture },
        { presentQuantity: 4, reorderAt: 20, category: 'INGREDIENT', expiryDate: new Date() },
        { presentQuantity: 50, reorderAt: 20, category: 'SEEDS', expiryDate: farFuture },
      ];

      KIInventoryItem.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockItems),
      });

      const req = makeReq();
      const res = makeRes();

      await controller.getInventoryStats(req, res);

      expect(KIInventoryItem.find).toHaveBeenCalledWith(
        {},
        { presentQuantity: 1, reorderAt: 1, category: 1, expiryDate: 1 },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Inventory stats fetched successfully.',
        data: {
          totalItems: 3,
          criticalStock: 1,
          lowStock: 1,
          preserved: 1,
        },
      });
    });

    test('returns 500 on error', async () => {
      KIInventoryItem.find.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      const req = makeReq();
      const res = makeRes();

      await controller.getInventoryStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Something went wrong while fetching inventory stats.',
      });
    });
  });
});
