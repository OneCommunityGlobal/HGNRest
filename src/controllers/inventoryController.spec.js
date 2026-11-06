/* eslint-disable */
jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));
jest.mock('../startup/logger', () => ({ logException: jest.fn(), logInfo: jest.fn() }));
afterEach(() => jest.restoreAllMocks());
const { mockRes, mockReq, assertResMock } = require('../test');
const helper = require('../utilities/permissions');
const projects = require('../models/project');
const wbs = require('../models/wbs');
const { hasPermission } = require('../utilities/permissions');
const inventoryController = require('./inventoryController');
const inventoryItem = require('../models/inventoryItem');
const inventoryItemType = require('../models/inventoryItemType');
const mongoose = require('mongoose');
const moment = require('moment');
const makeSut = () => {
  const { getAllInvInProjectWBS, postInvInProjectWBS } = inventoryController(
    inventoryItem,
    inventoryItemType,
    projects,
  );

  return {
    getAllInvInProjectWBS,
    postInvInProjectWBS,
  };
};
const flushPromises = () => new Promise(setImmediate);

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

describe('inventoryController', () => {
  describe('getAllInvInProjectWBS', () => {
    test('Ensure getAllInvInProjectWBS Returns error 403 if the user is not authorized to view the inventory data (missing getAllInvInProjectWBS Permission ).', async () => {
      const { getAllInvInProjectWBS } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const response = await getAllInvInProjectWBS(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReq.body.requestor,
        'getAllInvInProjectWBS',
      );
      assertResMock(403, 'You are not authorized to view inventory data.', response, mockRes);
    });

    test('Ensure getAllInvInProjectWBS Returns error 404 if an error occurs when fetching', async () => {
      const { getAllInvInProjectWBS } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

      const findObject = {
        populate: () => {},
      };

      const sortedObject = {
        sort: () => {},
      };

      const findSpy = jest.spyOn(inventoryItem, 'find').mockImplementationOnce(() => {
        return findObject;
      });
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => {
        return findObject;
      });
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => {
        return findObject;
      });
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => {
        return sortedObject;
      });

      jest
        .spyOn(sortedObject, 'sort')
        .mockImplementationOnce(() => Promise.reject(new Error('an error occured')));

      const response = await getAllInvInProjectWBS(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReq.body.requestor,
        'getAllInvInProjectWBS',
      );
      expect(findSpy).toHaveBeenCalledWith({
        project: mongoose.Types.ObjectId(mockReq.params.projectId),
        wbs: mongoose.Types.ObjectId(mockReq.params.wbsId),
        $gte: { quantity: 0 },
      });

      assertResMock(404, new Error('an error occured'), response, mockRes);
    });
    test('Ensure getAllInvInProjectWBS Returns status 200 if results are found sorted and popluated', async () => {
      const { getAllInvInProjectWBS } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

      const findObject = {
        populate: () => {},
        inventory: [{ project: 'someName', wbs: null }],
      };

      const sortedObject = {
        sort: () => {},
      };

      const findSpy = jest.spyOn(inventoryItem, 'find').mockImplementationOnce(() => {
        return findObject;
      });
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => {
        return findObject;
      });
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => {
        return findObject;
      });
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => {
        return sortedObject;
      });
      jest.spyOn(sortedObject, 'sort').mockImplementationOnce(() => {
        return Promise.resolve(findObject.inventory);
      });

      const response = await getAllInvInProjectWBS(mockReq, mockRes);

      expect(findSpy).toHaveBeenCalledWith({
        project: mongoose.Types.ObjectId(mockReq.params.projectId),
        wbs: mongoose.Types.ObjectId(mockReq.params.wbsId),
        $gte: { quantity: 0 },
      });

      assertResMock(200, findObject.inventory, response, mockRes);
    });
  });

  describe('postInvInProjectWBS', () => {
    test("Ensure postInvInProjectWBS Returns error 403 if the user doesn't have the postInvInProjectWBS permission", async () => {
      const { postInvInProjectWBS } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const response = await postInvInProjectWBS(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postInvInProjectWBS');
      assertResMock(403, 'You are not authorized to view inventory data.', response, mockRes);
    });
    test('Ensure postInvInProjectWBS Returns error 400 if valid project, but quantity and id are necessary as well as valid wbs if sent in and not Unassigned', async () => {
      const { postInvInProjectWBS } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);
      const findObject = {
        populate: () => {},
        inventory: [{ project: 'someName', wbs: null }],
      };
      mockReq.body.quantity = 1;
      mockReq.body.typeId = '';

      const projectExists = {
        select: () => {},
        lean: () => {},
      };

      const wbsExists = {
        select: () => {},
        lean: () => {},
      };

      const findSpyProjects = jest.spyOn(projects, 'findOne').mockImplementationOnce(() => {
        return projectExists;
      });
      jest.spyOn(projectExists, 'select').mockImplementationOnce(() => {
        return projectExists;
      });

      jest.spyOn(projectExists, 'lean').mockImplementationOnce(() => {
        return Promise.resolve(findObject.inventory);
      });

      // works move onto wbs findone
      const findSpyWbs = jest.spyOn(wbs, 'findOne').mockImplementationOnce(() => {
        return wbsExists;
      });
      jest.spyOn(wbsExists, 'select').mockImplementationOnce(() => {
        return wbsExists;
      });

      jest.spyOn(wbsExists, 'lean').mockImplementationOnce(() => {
        return Promise.resolve(findObject.inventory);
      });

      const findSpy = jest.spyOn(inventoryItem, 'find').mockImplementationOnce(() => {
        return Promise.reject(
          new Error(
            'Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned',
          ),
        );
      });

      const response = await postInvInProjectWBS(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postInvInProjectWBS');
      assertResMock(
        400,
        'Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned',
        response,
        mockRes,
      );
    });
    test('Ensure postInvInProjectWBS Returns error 500 if saving an inventoryItem occurs', async () => {
      const { postInvInProjectWBS } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);
      const findObject = {
        populate: () => {},
        inventory: [{ project: 'someName', wbs: null }],
      };
      mockReq.body.quantity = 1;
      mockReq.body.typeId = '6515fcc71dd1dbff0999e156';
      mockReq.body.wbsId = '6515fcc71dd1dbff0999e156';
      mockReq.body.projectId = '6515fcc71dd1dbff0999e156';
      mockReq.body.cost = 400;
      mockReq.body.poNum = '1234';
      const projectExists = {
        select: () => {},
        lean: () => {},
      };
      const wbsExists = {
        select: () => {},
        lean: () => {},
      };
      const inventoryExists = {
        select: () => {},
        lean: () => {},
        save: () => {},
      };
      const findSpyProjects = jest.spyOn(projects, 'findOne').mockImplementationOnce(() => {
        return projectExists;
      });
      jest.spyOn(projectExists, 'select').mockImplementationOnce(() => {
        return projectExists;
      });
      jest.spyOn(projectExists, 'lean').mockImplementationOnce(() => {
        return Promise.resolve(findObject.inventory);
      });
      // works move onto wbs findone
      const findSpyWbs = jest.spyOn(wbs, 'findOne').mockImplementationOnce(() => {
        return wbsExists;
      });
      jest.spyOn(wbsExists, 'select').mockImplementationOnce(() => {
        return wbsExists;
      });
      jest.spyOn(wbsExists, 'lean').mockImplementationOnce(() => {
        return Promise.resolve(findObject.inventory);
      });
      const findSpy = jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => {
        return inventoryExists;
      });
      jest.spyOn(inventoryExists, 'select').mockImplementationOnce(() => {
        return inventoryExists;
      });
      jest.spyOn(inventoryExists, 'lean').mockImplementationOnce(() => {
        return null;
      });

      jest.spyOn(inventoryItem.prototype, 'save').mockImplementationOnce(() => {
        return Promise.reject(new Error('an error occured'));
      });
      const response = await postInvInProjectWBS(mockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postInvInProjectWBS');
      assertResMock(500, new Error('an error occured'), response, mockRes);
    });

    test("Ensure postInvInProjectWBS Receives a 201 if an inventory item doesn't exist and is sucessfully created", async () => {
      const { postInvInProjectWBS } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);
      const findObject = {
        populate: () => {},
        inventory: [{ project: 'someName', wbs: null }],
      };
      const resolvedInventoryItem = new inventoryItem({
        project: mockReq.body.projectId,
        wbs: mockReq.body.wbsId,
        type: mockReq.body.typeId,
        quantity: mockReq.body.quantity,
        cost: mockReq.body.cost,
        poNum: mockReq.body.poNum,
      });
      mockReq.body.quantity = 1;
      mockReq.body.typeId = '6515fcc71dd1dbff0999e156';
      mockReq.body.wbsId = '6515fcc71dd1dbff0999e156';
      mockReq.body.projectId = '6515fcc71dd1dbff0999e156';
      mockReq.body.cost = 400;
      mockReq.body.poNum = '1234';

      const projectExists = {
        select: () => {},
        lean: () => {},
      };
      const wbsExists = {
        select: () => {},
        lean: () => {},
      };
      const inventoryExists = {
        select: () => {},
        lean: () => {},
        save: () => {},
      };
      const findSpyProjects = jest.spyOn(projects, 'findOne').mockImplementationOnce(() => {
        return projectExists;
      });
      jest.spyOn(projectExists, 'select').mockImplementationOnce(() => {
        return projectExists;
      });
      jest.spyOn(projectExists, 'lean').mockImplementationOnce(() => {
        return Promise.resolve(findObject.inventory);
      });
      // works move onto wbs findone
      const findSpyWbs = jest.spyOn(wbs, 'findOne').mockImplementationOnce(() => {
        return wbsExists;
      });
      jest.spyOn(wbsExists, 'select').mockImplementationOnce(() => {
        return wbsExists;
      });
      jest.spyOn(wbsExists, 'lean').mockImplementationOnce(() => {
        return Promise.resolve(findObject.inventory);
      });
      const findSpy = jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => {
        return inventoryExists;
      });
      jest.spyOn(inventoryExists, 'select').mockImplementationOnce(() => {
        return inventoryExists;
      });
      jest.spyOn(inventoryExists, 'lean').mockImplementationOnce(() => {
        return null;
      });

      jest.spyOn(inventoryItem.prototype, 'save').mockImplementationOnce(() => {
        return Promise.resolve(resolvedInventoryItem);
      });

      jest.spyOn(projects, 'findByIdAndUpdate').mockImplementationOnce(() => {
        return Promise.resolve({ _id: 'mockedProjectId', inventoryModifiedDatetime: Date.now() });
      });

      const response = await postInvInProjectWBS(mockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postInvInProjectWBS');
      assertResMock(201, resolvedInventoryItem, response, mockRes);
    });
    test('Ensure postInvInProjectWBS Receives a 201 if an inventory item does exist and is updated with new values', async () => {
      const { postInvInProjectWBS } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);
      const findObject = {
        populate: () => {},
        inventory: [{ project: 'someName', wbs: null }],
      };
      const resolvedInventoryItem = new inventoryItem({
        project: mockReq.body.projectId,
        wbs: mockReq.body.wbsId,
        type: mockReq.body.typeId,
        quantity: mockReq.body.quantity,
        cost: mockReq.body.cost,
        poNum: mockReq.body.poNum,
      });

      const updatedResolvedInventoryItem = new inventoryItem({
        project: mockReq.body.projectId,
        wbs: mockReq.body.wbsId,
        type: mockReq.body.typeId,
        quantity: mockReq.body.quantity,
        costPer: 200,
      });
      mockReq.body.quantity = 1;
      mockReq.body.typeId = '6515fcc71dd1dbff0999e156';
      mockReq.body.wbsId = 'Unassigned';
      mockReq.body.projectId = '';
      mockReq.body.cost = 400;
      mockReq.body.poNum = '1234';

      const projectExists = {
        select: () => {},
        lean: () => {},
      };
      const wbsExists = {
        select: () => {},
        lean: () => {},
      };
      const inventoryExists = {
        select: () => {},
        lean: () => {},
        save: () => {},
        inventory: [{ project: 'someName', wbs: null }],
      };
      const findSpyProjects = jest.spyOn(projects, 'findOne').mockImplementationOnce(() => {
        return projectExists;
      });
      jest.spyOn(projectExists, 'select').mockImplementationOnce(() => {
        return projectExists;
      });
      jest.spyOn(projectExists, 'lean').mockImplementationOnce(() => {
        return Promise.resolve(findObject.inventory);
      });
      // works move onto wbs findone
      const findSpyWbs = jest.spyOn(wbs, 'findOne').mockImplementationOnce(() => {
        return wbsExists;
      });
      jest.spyOn(wbsExists, 'select').mockImplementationOnce(() => {
        return wbsExists;
      });
      jest.spyOn(wbsExists, 'lean').mockImplementationOnce(() => {
        return Promise.resolve(findObject.inventory);
      });
      const findSpy = jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => {
        return inventoryExists;
      });
      jest.spyOn(inventoryExists, 'select').mockImplementationOnce(() => {
        return inventoryExists;
      });
      jest.spyOn(inventoryExists, 'lean').mockImplementationOnce(() => {
        return inventoryExists;
      });

      jest.spyOn(inventoryItem, 'findOneAndUpdate').mockImplementationOnce(() => {
        return Promise.resolve(resolvedInventoryItem);
      });

      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockImplementationOnce(() => {
        return Promise.resolve(updatedResolvedInventoryItem);
      });

      jest.spyOn(projects, 'findByIdAndUpdate').mockImplementationOnce(() => {
        return Promise.resolve({ _id: 'mockedProjectId', inventoryModifiedDatetime: Date.now() });
      });

      const response = await postInvInProjectWBS(mockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postInvInProjectWBS');
      assertResMock(201, updatedResolvedInventoryItem, response, mockRes);
    });
  });
});

// mockReq.body.typeId ='6515fcc71dd1dbff0999e156'

describe('inventory sorting timestamps', () => {
  const projectId = '6515fcc71dd1dbff0999e156';
  const invId = '6515fcc71dd1dbff0999e157';
  let Item;
  let Project;
  let ItemType;
  let controller;
  let req;
  let res;
  let record;
  const query = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

  beforeEach(() => {
    helper.hasPermission.mockResolvedValue(true);
    record = { _id: invId, project: projectId, quantity: 2, cost: 20 };
    Item = jest.fn().mockImplementation(() => ({ save: jest.fn().mockResolvedValue(record) }));
    Item.findOne = jest.fn().mockImplementation(() => query(null));
    Item.findOneAndUpdate = jest.fn().mockResolvedValue(record);
    Item.findByIdAndUpdate = jest.fn().mockResolvedValue(record);
    Item.findById = jest.fn().mockResolvedValue(record);
    Project = {
      findOne: jest.fn().mockImplementation(() => query({ _id: projectId })),
      findByIdAndUpdate: jest.fn().mockResolvedValue({ _id: projectId }),
    };
    ItemType = { findOne: jest.fn().mockImplementation(() => query({ _id: projectId })) };
    jest.spyOn(wbs, 'findOne').mockImplementation(() => query({ _id: projectId }));
    controller = inventoryController(Item, ItemType, Project);
    req = {
      params: { projectId, invId, wbsId: projectId },
      body: { quantity: 2, cost: 20, typeId: projectId },
    };
    res = { status: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis() };
  });

  test.each([
    ['postInvInProject', false],
    ['postInvInProject', true],
    ['postInvInProjectWBS', false],
    ['postInvInProjectWBS', true],
  ])('%s waits for its timestamp for existing inventory=%s', async (handler, existing) => {
    Item.findOne.mockImplementation(() => query(existing ? record : null));
    let finish;
    Project.findByIdAndUpdate.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = controller[handler](req, res);
    await flushPromises();
    expect(res.send).not.toHaveBeenCalled();
    expect(Project.findByIdAndUpdate).toHaveBeenCalledWith(
      projectId,
      { $max: { inventoryModifiedDatetime: expect.any(Date) } },
      { new: true },
    );
    finish({ _id: projectId });
    await pending;
    expect(res.status).toHaveBeenLastCalledWith(201);
    expect(res.send).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith(record);
  });

  const purchaseCases = [
    ['postInvInProject', false],
    ['postInvInProject', true],
    ['postInvInProjectWBS', false],
    ['postInvInProjectWBS', true],
  ];

  test.each(purchaseCases)(
    '%s preserves purchase data for existing inventory=%s',
    async (handler, existing) => {
      const typeId = '6515fcc71dd1dbff0999e158';
      const wbsId = '6515fcc71dd1dbff0999e159';
      req.params.wbsId = wbsId;
      req.body = { quantity: 2, cost: 20, typeId, poNum: 'PO-123', notes: 'Restocked' };
      Item.findOne.mockImplementation(() => query(existing ? record : null));
      const match = {
        project: mongoose.Types.ObjectId(projectId),
        wbs: handler === 'postInvInProjectWBS' ? mongoose.Types.ObjectId(wbsId) : null,
        inventoryItemType: mongoose.Types.ObjectId(typeId),
        wasted: false,
      };
      const note = {
        quantity: 2,
        typeOfMovement: 'Purchased',
        message: expect.stringMatching(/^Created 2 on \d{2}\/\d{2}\/\d{4} note: Restocked$/),
      };
      await controller[handler](req, res);
      expect(Item.findOne).toHaveBeenCalledWith(match);
      if (existing) {
        expect(Item).not.toHaveBeenCalled();
        expect(Item.findOneAndUpdate).toHaveBeenCalledWith(
          match,
          { $inc: { quantity: 2, cost: 20 }, $push: { notes: note, poNums: 'PO-123' } },
          { new: true },
        );
        expect(Item.findByIdAndUpdate).toHaveBeenCalledWith(invId, { costPer: 10 }, { new: true });
      } else {
        expect(Item).toHaveBeenCalledWith({
          ...match,
          quantity: 2,
          cost: 20,
          poNums: ['PO-123'],
          notes: [note],
          created: expect.any(Number),
        });
        expect(Item.mock.results[0].value.save).toHaveBeenCalledTimes(1);
        expect(Item.findOneAndUpdate).not.toHaveBeenCalled();
        expect(Item.findByIdAndUpdate).not.toHaveBeenCalled();
      }
      expect(res.status).toHaveBeenLastCalledWith(201);
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(res.send).toHaveBeenCalledWith(record);
    },
  );

  test.each([undefined, 'Unassigned'])(
    'WBS purchases normalize %s to unassigned inventory',
    async (wbsId) => {
      req.params.wbsId = wbsId;
      await controller.postInvInProjectWBS(req, res);
      expect(Item.findOne).toHaveBeenCalledWith(expect.objectContaining({ wbs: null }));
      expect(Item).toHaveBeenCalledWith(expect.objectContaining({ wbs: null }));
      expect(wbs.findOne).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenLastCalledWith(201);
    },
  );

  test('project purchases retain support for typeID form values', async () => {
    req.body.typeID = req.body.typeId;
    delete req.body.typeId;
    await controller.postInvInProject(req, res);
    expect(Item).toHaveBeenCalledWith(
      expect.objectContaining({ inventoryItemType: mongoose.Types.ObjectId(req.body.typeID) }),
    );
    expect(res.status).toHaveBeenLastCalledWith(201);
  });

  const invalidPurchaseTypeIds = [
    undefined,
    null,
    '',
    123,
    true,
    {},
    { $ne: null },
    { $gt: '' },
    { $regex: '.*' },
    { $oid: '6515fcc71dd1dbff0999e158' },
    ['6515fcc71dd1dbff0999e158'],
    'abcdefghijkl',
    'zzzzzzzzzzzzzzzzzzzzzzzz',
    '$where',
    '6515fcc71dd1dbff0999e158\n',
    ' 6515fcc71dd1dbff0999e158',
  ];

  describe.each([
    ['postInvInProject', 'typeId'],
    ['postInvInProject', 'typeID'],
    ['postInvInProjectWBS', 'typeId'],
    ['postInvInProjectWBS', 'typeID'],
  ])('%s purchase type validation using %s', (handler, field) => {
    test.each(invalidPurchaseTypeIds.map((value) => [value]))(
      'rejects %p before database access',
      async (value) => {
        delete req.body.typeId;
        delete req.body.typeID;
        req.body[field] = value;
        await controller[handler](req, res);
        expect(res.status).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledTimes(1);
        expect(Project.findOne).not.toHaveBeenCalled();
        expect(ItemType.findOne).not.toHaveBeenCalled();
        expect(wbs.findOne).not.toHaveBeenCalled();
        expect(Item.findOne).not.toHaveBeenCalled();
        expect(Item).not.toHaveBeenCalled();
        expect(Item.findOneAndUpdate).not.toHaveBeenCalled();
        expect(Item.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(Project.findByIdAndUpdate).not.toHaveBeenCalled();
      },
    );

    test.each([false, true])(
      'accepts a hexadecimal ID as an ObjectId for existing inventory=%s',
      async (existing) => {
        const typeId = '6515FCC71DD1DBFF0999E158';
        const expectedId = mongoose.Types.ObjectId(typeId);
        delete req.body.typeId;
        delete req.body.typeID;
        req.body[field] = typeId;
        Item.findOne.mockImplementation(() => query(existing ? record : null));
        await controller[handler](req, res);
        if (handler === 'postInvInProject') {
          expect(ItemType.findOne).toHaveBeenCalledWith({ _id: expectedId });
        }
        expect(Item.findOne).toHaveBeenCalledWith(
          expect.objectContaining({ inventoryItemType: expectedId }),
        );
        if (existing) {
          expect(Item.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ inventoryItemType: expectedId }),
            expect.any(Object),
            { new: true },
          );
        } else {
          expect(Item).toHaveBeenCalledWith(
            expect.objectContaining({ inventoryItemType: expectedId }),
          );
        }
        expect(res.status).toHaveBeenLastCalledWith(201);
        expect(res.send).toHaveBeenCalledTimes(1);
      },
    );
  });

  test.each(['postInvInProject', 'postInvInProjectWBS'])(
    '%s does not fall back from an operator object to a valid alternate ID',
    async (handler) => {
      req.body.typeID = req.body.typeId;
      req.body.typeId = { $ne: null };
      await controller[handler](req, res);
      expect(res.status).toHaveBeenLastCalledWith(400);
      expect(ItemType.findOne).not.toHaveBeenCalled();
      expect(Item.findOne).not.toHaveBeenCalled();
      expect(Item.findOneAndUpdate).not.toHaveBeenCalled();
      expect(Project.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );

  test.each(['postInvInProject', 'postInvInProjectWBS'])(
    '%s calculates costPer from the merged record and handles zero quantity',
    async (handler) => {
      Item.findOne.mockImplementation(() => query(record));
      Item.findOneAndUpdate.mockResolvedValueOnce({ ...record, quantity: 6, cost: 30 });
      const updatedRecord = { ...record, quantity: 6, cost: 30, costPer: 5 };
      Item.findByIdAndUpdate.mockResolvedValueOnce(updatedRecord);
      await controller[handler](req, res);
      expect(Item.findByIdAndUpdate).toHaveBeenLastCalledWith(invId, { costPer: 5 }, { new: true });
      expect(res.send).toHaveBeenLastCalledWith(updatedRecord);

      Item.findOneAndUpdate.mockResolvedValueOnce({ ...record, quantity: 0 });
      await controller[handler](req, res);
      expect(Item.findByIdAndUpdate).toHaveBeenLastCalledWith(invId, { costPer: 0 }, { new: true });
    },
  );

  test.each(['postInvInProject', 'postInvInProjectWBS'])(
    '%s waits for costPer persistence before advancing the project timestamp',
    async (handler) => {
      Item.findOne.mockImplementation(() => query(record));
      let finish;
      Item.findByIdAndUpdate.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const pending = controller[handler](req, res);
      await flushPromises();
      expect(Project.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
      finish(record);
      await pending;
      expect(Project.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenLastCalledWith(201);
      expect(res.send).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    ['postInvInProject', 'save'],
    ['postInvInProject', 'increment'],
    ['postInvInProject', 'costPer'],
    ['postInvInProjectWBS', 'save'],
    ['postInvInProjectWBS', 'increment'],
    ['postInvInProjectWBS', 'costPer'],
  ])('%s stops after a failed %s write', async (handler, stage) => {
    const error = new Error('purchase write failed');
    Item.findOne.mockImplementation(() => query(stage === 'save' ? null : record));
    if (stage === 'save') {
      Item.mockImplementationOnce(() => ({ save: jest.fn().mockRejectedValue(error) }));
    } else if (stage === 'increment') {
      Item.findOneAndUpdate.mockRejectedValueOnce(error);
    } else {
      Item.findByIdAndUpdate.mockRejectedValueOnce(error);
    }
    await controller[handler](req, res);
    expect(Project.findByIdAndUpdate).not.toHaveBeenCalled();
    if (stage !== 'costPer') expect(Item.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith(error);
  });

  test.each(purchaseCases)(
    '%s preserves timestamp error responses for existing inventory=%s',
    async (handler, existing) => {
      const error = new Error('timestamp write failed');
      Item.findOne.mockImplementation(() => query(existing ? record : null));
      Project.findByIdAndUpdate.mockRejectedValueOnce(error);
      await controller[handler](req, res);
      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(res.send).toHaveBeenCalledWith(existing ? error : error.message);
    },
  );

  test.each([
    ['postInvInProject', 'project'],
    ['postInvInProject', 'quantity'],
    ['postInvInProject', 'type'],
    ['postInvInProjectWBS', 'project'],
    ['postInvInProjectWBS', 'quantity'],
    ['postInvInProjectWBS', 'type'],
    ['postInvInProjectWBS', 'wbs'],
  ])('%s rejects invalid %s before purchase writes', async (handler, field) => {
    if (field === 'project') Project.findOne.mockImplementationOnce(() => query(null));
    if (field === 'quantity') req.body.quantity = 0;
    if (field === 'type') {
      if (handler === 'postInvInProject')
        ItemType.findOne.mockImplementationOnce(() => query(null));
      else req.body.typeId = '';
    }
    if (field === 'wbs') wbs.findOne.mockImplementationOnce(() => query(null));
    await controller[handler](req, res);
    expect(Item).not.toHaveBeenCalled();
    expect(Item.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Item.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(Project.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenLastCalledWith(400);
    expect(res.send).toHaveBeenCalledTimes(1);
  });

  test('an edit preserves ownership/history and updates the stored owning project', async () => {
    delete req.params.projectId;
    req.body = { quantity: 5, notes: 'corrected count', projectId: invId, wbsId: null };
    await controller.putInvById(req, res);
    expect(Item.findByIdAndUpdate).toHaveBeenCalledWith(
      invId,
      {
        $set: { quantity: 5, costPer: 4 },
        $push: {
          notes: {
            quantity: 5,
            typeOfMovement: 'Edited',
            message: 'corrected count',
            modified: expect.any(Date),
          },
        },
      },
      { new: true },
    );
    expect(Project.findByIdAndUpdate).toHaveBeenCalledWith(projectId, expect.any(Object), {
      new: true,
    });
    expect(res.status).toHaveBeenLastCalledWith(200);
  });

  test('edits wait for timestamp persistence before reporting success', async () => {
    let finish;
    Project.findByIdAndUpdate.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = controller.putInvById(req, res);
    await flushPromises();
    expect(res.send).not.toHaveBeenCalled();
    finish({ _id: projectId });
    await pending;
    expect(res.status).toHaveBeenLastCalledWith(200);
  });

  test('partial edits preserve unsupplied fields and handle zero quantity', async () => {
    req.body = { quantity: 0 };
    await controller.putInvById(req, res);
    expect(Item.findByIdAndUpdate).toHaveBeenCalledWith(
      invId,
      { $set: { quantity: 0, costPer: 0 } },
      { new: true },
    );
  });

  test('a failed inventory write does not advance the timestamp', async () => {
    Item.findByIdAndUpdate.mockRejectedValueOnce(new Error('inventory write failed'));
    await controller.putInvById(req, res);
    expect(Project.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenLastCalledWith(500);
  });

  test.each(['postInvInProject', 'postInvInProjectWBS', 'putInvById'])(
    '%s reports a timestamp write failure once',
    async (handler) => {
      Project.findByIdAndUpdate.mockRejectedValueOnce(new Error('timestamp write failed'));
      await controller[handler](req, res);
      expect(res.status).toHaveBeenLastCalledWith(500);
      expect(res.send).toHaveBeenCalledTimes(1);
    },
  );

  test('a missing item does not advance any timestamp', async () => {
    Item.findById.mockResolvedValueOnce(null);
    await controller.putInvById(req, res);
    expect(Item.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(Project.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenLastCalledWith(404);
  });

  test('a missing project during timestamp update is not reported as success', async () => {
    Project.findByIdAndUpdate.mockResolvedValueOnce(null);
    await controller.putInvById(req, res);
    expect(res.status).toHaveBeenLastCalledWith(500);
  });

  test.each(['postInvInProject', 'postInvInProjectWBS', 'putInvById'])(
    '%s rejects denied permissions before writing',
    async (handler) => {
      helper.hasPermission.mockResolvedValueOnce(false);
      await controller[handler](req, res);
      expect(Item).not.toHaveBeenCalled();
      expect(Item.findOneAndUpdate).not.toHaveBeenCalled();
      expect(Item.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(Project.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenLastCalledWith(403);
    },
  );

  test('inventory reads do not advance the project timestamp', async () => {
    const listQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([]),
    };
    Item.find = jest.fn().mockReturnValue(listQuery);
    await controller.getAllInvInProject(req, res);
    expect(Project.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenLastCalledWith(200);
  });

  test('new projects have no inventory edit timestamp', () => {
    expect(
      new projects({ projectName: 'No inventory edits' }).inventoryModifiedDatetime,
    ).toBeNull();
  });

  test('archived and unarchived project responses include the sorting timestamp', async () => {
    const projectController = require('./projectController')(Project);
    const result = [{ _id: projectId, inventoryModifiedDatetime: new Date('2025-01-01') }];
    Project.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(result) });
    await projectController.getAllProjects(req, res);
    await projectController.getArchivedProjects(req, res);
    Project.find.mock.calls.forEach(([, fields]) =>
      expect(fields).toContain('inventoryModifiedDatetime'),
    );
    expect(res.send).toHaveBeenLastCalledWith(result);
  });

  test('ordinary project edits cannot overwrite an inventory timestamp with a stale value', async () => {
    const timestamp = new Date('2025-01-01');
    const saved = {
      projectName: 'Original',
      category: 'Food',
      isArchived: false,
      isActive: true,
      inventoryModifiedDatetime: timestamp,
      save: jest.fn().mockResolvedValue(),
    };
    Project.find = jest.fn().mockResolvedValue([]);
    Project.findById = jest.fn().mockResolvedValue(saved);
    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(),
      abortTransaction: jest.fn().mockResolvedValue(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    const projectController = require('./projectController')(Project);
    req.body = { _id: projectId, projectName: 'Renamed', inventoryModifiedDatetime: '2000-01-01' };
    await projectController.putProject(req, res);
    expect(saved.inventoryModifiedDatetime).toBe(timestamp);
    expect(saved.save).toHaveBeenCalledWith({ session });
    expect(res.status).toHaveBeenLastCalledWith(200);
  });
});
