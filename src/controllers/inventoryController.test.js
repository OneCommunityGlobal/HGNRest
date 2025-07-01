jest.setTimeout(10000);

const mockWbsModel = { findOne: jest.fn() };
jest.mock('../models/wbs', () => mockWbsModel);

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
  canRequestorUpdateUser: jest.fn(),
}));

jest.mock('mongoose', () => ({
  Types: {
    ObjectId: jest.fn((id) => id),
  },
}));

jest.mock('moment', () => () => ({
  format: () => '01/01/2020',
}));

jest.mock('../utilities/escapeRegex', () => jest.fn((str) => str));

const permissions = require('../utilities/permissions');

const mockProjectModel = {
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
};

function MockItem(data) {
  Object.assign(this, data);
  this.save = jest.fn().mockResolvedValue(this);
}
MockItem.find = jest.fn();
MockItem.findOne = jest.fn();
MockItem.findById = jest.fn();
MockItem.findByIdAndUpdate = jest.fn().mockResolvedValue({});
MockItem.findByIdAndDelete = jest.fn();
MockItem.findOneAndUpdate = jest.fn().mockResolvedValue({});
MockItem.create = jest.fn();

function MockItemType(data) {
  Object.assign(this, data);
  this.save = jest.fn().mockResolvedValue(this);
}
MockItemType.find = jest.fn();
MockItemType.findOne = jest.fn();
MockItemType.findById = jest.fn();
MockItemType.findByIdAndUpdate = jest.fn().mockResolvedValue({});
MockItemType.create = jest.fn();

function createMockQuery(result) {
  const chain = {
    select: jest.fn(() => chain),
    lean: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    exec: jest.fn(() => Promise.resolve(result)),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected) => Promise.resolve(result).catch(onRejected),
  };
  return chain;
}

function createMockQueryReject(error) {
  const chain = {
    select: jest.fn(() => chain),
    lean: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    exec: jest.fn(() => Promise.reject(error)),
    then: (onFulfilled, onRejected) => Promise.reject(error).then(onFulfilled, onRejected),
    catch: (onRejected) => Promise.reject(error).catch(onRejected),
  };
  return chain;
}

function createThenable(result) {
  return {
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected) => Promise.resolve(result).catch(onRejected),
  };
}

const inventoryControllerFactory = require('./inventoryController');
const inventoryController = inventoryControllerFactory(MockItem, MockItemType, mockProjectModel);

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

function saveFails() {
  return jest.fn().mockRejectedValue(new Error('DB save error'));
}
function saveSucceeds(doc = {}) {
  return jest.fn().mockResolvedValue(doc);
}

describe('inventoryController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    MockItem.find.mockReturnValue(createMockQuery([]));
    MockItem.findOne.mockReturnValue(createMockQuery(null));
    MockItem.findById.mockReturnValue(createMockQuery(null));
    MockItem.findOneAndUpdate.mockReturnValue(createMockQuery(null));
    MockItem.findByIdAndUpdate.mockReturnValue(createMockQuery(null));

    MockItemType.find.mockReturnValue(createMockQuery([]));
    MockItemType.findOne.mockReturnValue(createMockQuery(null));
    MockItemType.findById.mockReturnValue(createMockQuery(null));
    MockItemType.findByIdAndUpdate.mockReturnValue(createMockQuery(null));

    MockItem.prototype.save = saveFails();
    MockItemType.prototype.save = jest.fn().mockResolvedValue({});

    req = { params: {}, body: {}, user: { _id: 'user123' } };
    res = buildRes();
  });

  describe('getAllInvInProjectWBS', () => {
    beforeEach(() => {
      req.params = { projectId: 'project123', wbsId: 'wbs123' };
      req.body.requestor = { _id: 'user123' };
    });

    it('1. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.getAllInvInProjectWBS(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to view inventory data.');
    });

    it('2. 200 when query succeeds', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      const mockData = [{ name: 'item1', quantity: 5 }];
      MockItem.find.mockReturnValue(createMockQuery(mockData));

      await inventoryController.getAllInvInProjectWBS(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockData);
    });

    it('3. 404 when DB error', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      const dbError = new Error('Database error');
      MockItem.find.mockReturnValue(createMockQueryReject(dbError));

      await inventoryController.getAllInvInProjectWBS(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith(dbError);
    });
  });

  describe('postInvInProjectWBS', () => {
    beforeEach(() => {
      req.params = { projectId: 'project123', wbsId: 'wbs123' };
      req.body = {
        requestor: { _id: 'user123' },
        quantity: 10,
        cost: 100,
        typeId: 'type123',
        poNum: 'PO-001',
        notes: 'Test notes',
      };
    });

    it('4. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.postInvInProjectWBS(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to view inventory data.');
    });

    it('5. 400 when missing required fields', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      req.body.quantity = null;
      req.body.typeId = null;

      await inventoryController.postInvInProjectWBS(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned',
      );
    });

    it('6. 201 create new item when not exists', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      mockProjectModel.findOne.mockReturnValue(createMockQuery({ _id: 'project123' }));
      mockWbsModel.findOne.mockReturnValue(createMockQuery({ _id: 'wbs123' }));
      MockItem.findOne.mockReturnValue(createMockQuery(null));
      MockItem.prototype.save = jest.fn().mockResolvedValue({ _id: 'newItem', quantity: 10 });

      await inventoryController.postInvInProjectWBS(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('7. 201 update existing item', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      mockProjectModel.findOne.mockReturnValue(createMockQuery({ _id: 'project123' }));
      mockWbsModel.findOne.mockReturnValue(createMockQuery({ _id: 'wbs123' }));
      MockItem.findOne.mockReturnValue(createMockQuery({ _id: 'existingItem' }));
      MockItem.findOneAndUpdate.mockResolvedValue({ _id: 'existingItem', quantity: 15 });
      MockItem.findByIdAndUpdate.mockResolvedValue({ _id: 'existingItem' });

      await inventoryController.postInvInProjectWBS(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('8. 500 when DB fails on save', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      mockProjectModel.findOne.mockReturnValue(createMockQuery({ _id: 'project123' }));
      mockWbsModel.findOne.mockReturnValue(createMockQuery({ _id: 'wbs123' }));
      MockItem.findOne.mockReturnValue(createMockQuery(null));
      MockItem.prototype.save = saveFails();

      await inventoryController.postInvInProjectWBS(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAllInvInProject', () => {
    beforeEach(() => {
      req.params = { projectId: 'project123' };
      req.body.requestor = { _id: 'user123' };
    });

    it('9. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.getAllInvInProject(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to view inventory data.');
    });

    it('10. 200 when query succeeds', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      const mockData = [{ name: 'item1', quantity: 5 }];
      MockItem.find.mockReturnValue(createMockQuery(mockData));

      await inventoryController.getAllInvInProject(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockData);
    });

    it('11. 404 when DB error', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      const dbError = new Error('Database error');
      MockItem.find.mockReturnValue(createMockQueryReject(dbError));

      await inventoryController.getAllInvInProject(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith(dbError);
    });
  });

  describe('postInvInProject', () => {
    beforeEach(() => {
      req.params = { projectId: 'project123' };
      req.body = {
        requestor: { _id: 'user123' },
        quantity: 10,
        cost: 100,
        typeId: 'type123',
        poNum: 'PO-001',
        notes: 'Test notes',
      };
    });

    it('12. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.postInvInProject(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to post new inventory data.');
    });

    it('13. 400 when missing required fields', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      req.body.quantity = null;
      req.body.typeId = null;

      await inventoryController.postInvInProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Valid Project, Quantity and Type Id are necessary');
    });

    it('14. 201 when NEW inventory created', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      mockProjectModel.findOne.mockReturnValue(createMockQuery({ _id: 'project123' }));
      MockItemType.findOne.mockReturnValue(createMockQuery({ _id: 'type123' }));
      MockItem.findOne.mockReturnValue(createMockQuery(null));
      MockItem.prototype.save = jest.fn().mockResolvedValue({ _id: 'newInvId', quantity: 10 });

      await inventoryController.postInvInProject(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('15. 201 when EXISTING inventory updated', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      mockProjectModel.findOne.mockReturnValue(createMockQuery({ _id: 'project123' }));
      MockItemType.findOne.mockReturnValue(createMockQuery({ _id: 'type123' }));
      MockItem.findOne.mockReturnValue(createMockQuery({ _id: 'existId' }));
      MockItem.findOneAndUpdate.mockResolvedValue({ _id: 'existId', quantity: 15 });
      MockItem.findByIdAndUpdate.mockResolvedValue({});

      await inventoryController.postInvInProject(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('16. 500 when DB save fails', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      mockProjectModel.findOne.mockReturnValue(createMockQuery({ _id: 'project123' }));
      MockItemType.findOne.mockReturnValue(createMockQuery({ _id: 'type123' }));
      MockItem.findOne.mockReturnValue(createMockQuery(null));
      MockItem.prototype.save = saveFails();

      await inventoryController.postInvInProject(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('transferInvById', () => {
    beforeEach(() => {
      req.params = { invId: 'inv123' };
      req.body = {
        requestor: { _id: 'user123' },
        projectId: 'project123',
        wbsId: 'wbs123',
        quantity: 5,
        notes: 'Transfer notes',
      };
    });

    it('17. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.transferInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to transfer inventory data.');
    });

    it('18. 400 when invalid inventory or quantity', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne.mockReturnValue(createMockQuery(null));

      await inventoryController.transferInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'You must send a valid Inventory Id with enough quantity that you requested to be transfered.',
      );
    });

    it('19. 400 when project/WBS not found', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne.mockReturnValue(createMockQuery({ _id: 'inv123', quantity: 10 }));
      mockProjectModel.findOne.mockReturnValue(createMockQuery(null));

      await inventoryController.transferInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('20. 201 transfer to existing item', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne
        .mockReturnValueOnce(createMockQuery({ _id: 'inv123', quantity: 10, costPer: 10 }))
        .mockReturnValueOnce(createMockQuery({ _id: 'existingItem' }));
      mockProjectModel.findOne.mockReturnValue(createMockQuery({ _id: 'project123' }));
      mockWbsModel.findOne.mockReturnValue(createMockQuery({ _id: 'wbs123' }));
      MockItem.findByIdAndUpdate.mockResolvedValue({ _id: 'updatedItem' });

      await inventoryController.transferInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('21. 201 transfer create new item', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne
        .mockReturnValueOnce(createMockQuery({ _id: 'inv123', quantity: 10, costPer: 10 }))
        .mockReturnValueOnce(createMockQuery(null));
      mockProjectModel.findOne.mockReturnValue(createMockQuery({ _id: 'project123' }));
      mockWbsModel.findOne.mockReturnValue(createMockQuery({ _id: 'wbs123' }));
      MockItem.findByIdAndUpdate.mockResolvedValue({ _id: 'updatedItem' });
      MockItem.prototype.save = saveSucceeds({ _id: 'newItem' });

      await inventoryController.transferInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('22. 500 when DB error', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne.mockReturnValue(createMockQueryReject(new Error('DB error')));

      await inventoryController.transferInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('delInvById (waste inventory)', () => {
    beforeEach(() => {
      req.params = { invId: 'inv123' };
      req.body = {
        requestor: { _id: 'user123' },
        projectId: 'project123',
        wbsId: 'wbs123',
        quantity: 5,
        notes: 'Waste notes',
      };
    });

    it('23. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.delInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to waste inventory.');
    });

    it('24. 400 when invalid inventory or quantity', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne.mockReturnValue(createMockQuery(null));

      await inventoryController.delInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'You must send a valid Inventory Id with enough quantity that you requested to be wasted.',
      );
    });

    it('25. 400 when project/WBS not found', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne.mockResolvedValue({ _id: 'inv123', quantity: 10 });
      mockProjectModel.findOne.mockResolvedValue(null);

      await inventoryController.delInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('26. 201 waste to existing item', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne
        .mockResolvedValueOnce({ _id: 'inv123', quantity: 10, costPer: 10 })
        .mockResolvedValueOnce({ _id: 'existingItem' });
      mockProjectModel.findOne.mockResolvedValue({ _id: 'project123' });
      mockWbsModel.findOne.mockResolvedValue({ _id: 'wbs123' });
      MockItem.findByIdAndUpdate.mockResolvedValue({ _id: 'updatedItem' });

      await inventoryController.delInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('27. 201 waste create new item', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne
        .mockResolvedValueOnce({ _id: 'inv123', quantity: 10, costPer: 10 })
        .mockResolvedValueOnce(null);
      mockProjectModel.findOne.mockResolvedValue({ _id: 'project123' });
      mockWbsModel.findOne.mockResolvedValue({ _id: 'wbs123' });
      MockItem.findByIdAndUpdate.mockResolvedValue({ _id: 'updatedItem' });
      MockItem.prototype.save = saveSucceeds({ _id: 'newItem' });

      await inventoryController.delInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('28. 500 when DB error', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne.mockReturnValue(createMockQueryReject(new Error('DB error')));

      await inventoryController.delInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('unWasteInvById', () => {
    beforeEach(() => {
      req.params = { invId: 'inv123' };
      req.body = {
        requestor: { _id: 'user123' },
        projectId: 'project123',
        wbsId: 'wbs123',
        quantity: 5,
        notes: 'Unwaste notes',
      };
    });

    it('29. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.unWasteInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to unwaste inventory.');
    });

    it('30. 400 when invalid inventory or quantity', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne.mockReturnValue(createMockQuery(null));

      await inventoryController.unWasteInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'You must send a valid Inventory Id with enough quantity that you requested to be unwasted.',
      );
    });

    it('31. 400 when project/WBS not found', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne.mockResolvedValue({ _id: 'inv123', quantity: 10 });
      mockProjectModel.findOne.mockResolvedValue(null);

      await inventoryController.unWasteInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('32. 201 unwaste to existing item', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne
        .mockResolvedValueOnce({ _id: 'inv123', quantity: 10, costPer: 10 })
        .mockResolvedValueOnce({ _id: 'existingItem' });
      mockProjectModel.findOne.mockResolvedValue({ _id: 'project123' });
      mockWbsModel.findOne.mockResolvedValue({ _id: 'wbs123' });
      MockItem.findByIdAndUpdate.mockResolvedValue({ _id: 'updatedItem' });

      await inventoryController.unWasteInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('33. 201 unwaste create new item', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne
        .mockResolvedValueOnce({ _id: 'inv123', quantity: 10, costPer: 10 })
        .mockResolvedValueOnce(null);
      mockProjectModel.findOne.mockResolvedValue({ _id: 'project123' });
      mockWbsModel.findOne.mockResolvedValue({ _id: 'wbs123' });
      MockItem.findByIdAndUpdate.mockResolvedValue({ _id: 'updatedItem' });
      MockItem.prototype.save = saveSucceeds({ _id: 'newItem' });

      await inventoryController.unWasteInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('34. 500 when DB error', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findOne.mockReturnValue(createMockQueryReject(new Error('DB error')));

      await inventoryController.unWasteInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getInvIdInfo', () => {
    beforeEach(() => {
      req.params = { invId: 'inv123' };
      req.body.requestor = { _id: 'user123' };
    });

    it('35. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.getInvIdInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to get inventory by id.');
    });

    it('36. 200 when item found', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      const mockItem = { _id: 'inv123', name: 'Test Item', quantity: 5 };
      MockItem.findById.mockReturnValue(createThenable(mockItem));

      await inventoryController.getInvIdInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockItem);
    });

    it('37. 404 when DB error', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      const dbError = new Error('Item not found');
      MockItem.findById.mockReturnValue(createMockQueryReject(dbError));

      await inventoryController.getInvIdInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith(dbError);
    });
  });

  describe('putInvById', () => {
    beforeEach(() => {
      req.params = { invId: 'inv123', projectId: 'project123' };
      req.body = {
        requestor: { _id: 'user123' },
        quantity: 10,
        cost: 100,
        typeId: 'type123',
        poNum: 'PO-001',
        notes: 'Update notes',
      };
    });

    it('38. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.putInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to edit inventory by id.');
    });

    it('39. 200 when update succeeds', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findByIdAndUpdate.mockResolvedValue({ _id: 'inv123' });
      mockProjectModel.findByIdAndUpdate.mockResolvedValue({ _id: 'project123' });

      await inventoryController.putInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ message: 'Inventory successfully updated' });
    });

    it('40. 404 when record not found', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findByIdAndUpdate.mockResolvedValue(null);

      await inventoryController.putInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({ error: 'No valid record found' });
    });

    it('41. 500 when DB error', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItem.findByIdAndUpdate.mockRejectedValue(new Error('DB error'));

      await inventoryController.putInvById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: 'An internal error occurred' });
    });
  });

  describe('getInvTypeById', () => {
    beforeEach(() => {
      req.params = { typeId: 'type123' };
      req.body.requestor = { _id: 'user123' };
    });

    it('42. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.getInvTypeById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to get inv type by id.');
    });

    it('43. 200 when type found', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      const mockType = { _id: 'type123', name: 'Test Type', description: 'Test Description' };
      MockItemType.findById.mockReturnValue(createThenable(mockType));

      await inventoryController.getInvTypeById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockType);
    });

    it('44. 404 when DB error', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      const dbError = new Error('Type not found');
      MockItemType.findById.mockReturnValue(createMockQueryReject(dbError));

      await inventoryController.getInvTypeById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith(dbError);
    });
  });

  describe('putInvType', () => {
    beforeEach(() => {
      req.params = { typeId: 'type123' };
      req.body = {
        requestor: { _id: 'user123' },
        name: 'Updated Type',
        description: 'Updated Description',
        imageUrl: 'http://example.com/image.jpg',
        quantifier: 'pieces',
      };
    });

    it('45. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.putInvType(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to edit an inventory type.');
    });

    it('46. 200 when update succeeds', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItemType.findByIdAndUpdate.mockImplementation((id, data, callback) => {
        callback(null, { _id: 'type123', ...data });
      });

      await inventoryController.putInvType(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ message: 'Inv Type successfully updated' });
    });

    it('47. 400 when record not found', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItemType.findByIdAndUpdate.mockImplementation((id, data, callback) => {
        callback(new Error('Not found'), null);
      });

      await inventoryController.putInvType(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ error: 'No valid records found' });
    });

    it('48. 400 when DB error', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItemType.findByIdAndUpdate.mockImplementation((id, data, callback) => {
        callback(new Error('DB error'), null);
      });

      await inventoryController.putInvType(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ error: 'No valid records found' });
    });
  });

  describe('getAllInvType', () => {
    beforeEach(() => {
      req.body.requestor = { _id: 'user123' };
    });

    it('49. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.getAllInvType(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to get all inventory.');
    });

    it('50. 200 when types found', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      const mockTypes = [
        { _id: 'type1', name: 'Type 1' },
        { _id: 'type2', name: 'Type 2' },
      ];
      MockItemType.find.mockReturnValue(createMockQuery(mockTypes));

      await inventoryController.getAllInvType(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockTypes);
    });

    it('51. 404 when DB error', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      const dbError = new Error('Database error');
      MockItemType.find.mockReturnValue(createMockQueryReject(dbError));

      await inventoryController.getAllInvType(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith(dbError);
    });
  });

  describe('postInvType', () => {
    beforeEach(() => {
      req.body = {
        requestor: { _id: 'user123' },
        name: 'New Type',
        description: 'New Description',
        imageUrl: 'http://example.com/image.jpg',
        quantifier: 'pieces',
        type: 'material',
        uom: 'pieces',
        totalStock: 100,
        totalAvailable: 50,
        link: 'http://example.com',
      };
    });

    it('52. 403 when no permission', async () => {
      permissions.hasPermission.mockResolvedValue(false);

      await inventoryController.postInvType(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('You are not authorized to save an inventory type.');
    });

    it('53. 400 when duplicate name exists', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItemType.find.mockResolvedValue([{ _id: 'existingType', name: 'New Type' }]);

      await inventoryController.postInvType(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        error:
          'Another ItemType with name New Type already exists. Sorry, but item names should be like snowflakes, no two should be the same.',
      });
    });

    it('54. 201 when type created successfully', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItemType.find.mockResolvedValue([]);
      MockItemType.prototype.save = jest
        .fn()
        .mockResolvedValue({ _id: 'newType', name: 'New Type' });

      await inventoryController.postInvType(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('55. 500 when DB error', async () => {
      permissions.hasPermission.mockResolvedValue(true);
      MockItemType.find.mockResolvedValue([]);
      MockItemType.prototype.save = jest.fn().mockRejectedValue(new Error('DB save error'));

      await inventoryController.postInvType(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
