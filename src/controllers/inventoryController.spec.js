/* eslint-disable */
const { mockRes, mockReq, assertResMock } = require('../test');
const helper = require('../utilities/permissions');

jest.mock('../models/project', () => ({
  findOne: jest.fn(() => ({
    select: () => ({
      lean: () => Promise.resolve({}),
    }),
  })),
  findByIdAndUpdate: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../models/wbs', () => ({
  findOne: jest.fn(() => ({
    select: () => ({
      lean: () => Promise.resolve({}),
    }),
  })),
}));
jest.mock('../models/inventoryItem', () => {
  function InventoryItem(data) {
    Object.assign(this, data);
  }
  InventoryItem.find = jest.fn();
  InventoryItem.findOne = jest.fn();
  InventoryItem.findOneAndUpdate = jest.fn();
  InventoryItem.findByIdAndUpdate = jest.fn();
  InventoryItem.prototype.save = jest.fn();
  return InventoryItem;
});
jest.mock('../models/inventoryItemType', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

const projects = require('../models/project');
const wbs = require('../models/wbs');
const inventoryController = require('./inventoryController');
const inventoryItem = require('../models/inventoryItem');
const inventoryItemType = require('../models/inventoryItemType');
const mongoose = require('mongoose');
const moment = require('moment');
const flushPromises = () => new Promise(setImmediate);

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('inventoryController', () => {
  describe('getAllInvInProjectWBS', () => {
    test('Ensure getAllInvInProjectWBS Returns error 403 if the user is not authorized to view the inventory data (missing getAllInvInProjectWBS Permission ).', async () => {
      const { getAllInvInProjectWBS } = inventoryController(
        inventoryItem,
        inventoryItemType,
        projects,
      );
      const hasPermissionSpy = mockHasPermission(false);
      const response = await getAllInvInProjectWBS(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReq.body.requestor,
        'getAllInvInProjectWBS',
      );
      assertResMock(403, 'You are not authorized to view inventory data.', response, mockRes);
    });

    test('Ensure getAllInvInProjectWBS Returns error 404 if an error occurs when fetching', async () => {
      const { getAllInvInProjectWBS } = inventoryController(
        inventoryItem,
        inventoryItemType,
        projects,
      );
      const hasPermissionSpy = mockHasPermission(true);

      const findObject = {
        populate: () => findObject,
      };
      const sortedObject = {
        sort: () => Promise.reject(new Error('an error occured')),
      };

      jest.spyOn(inventoryItem, 'find').mockImplementationOnce(() => findObject);
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => findObject);
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => findObject);
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => sortedObject);

      const response = await getAllInvInProjectWBS(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReq.body.requestor,
        'getAllInvInProjectWBS',
      );
      assertResMock(404, new Error('an error occured'), response, mockRes);
    });

    test('Ensure getAllInvInProjectWBS Returns status 200 if results are found sorted and popluated', async () => {
      const { getAllInvInProjectWBS } = inventoryController(
        inventoryItem,
        inventoryItemType,
        projects,
      );
      mockHasPermission(true);

      const inventory = [{ project: 'someName', wbs: null }];
      const findObject = {
        populate: () => findObject,
        inventory,
      };
      const sortedObject = {
        sort: () => Promise.resolve(inventory),
      };

      jest.spyOn(inventoryItem, 'find').mockImplementationOnce(() => findObject);
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => findObject);
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => findObject);
      jest.spyOn(findObject, 'populate').mockImplementationOnce(() => sortedObject);
      jest.spyOn(sortedObject, 'sort').mockImplementationOnce(() => Promise.resolve(inventory));

      const response = await getAllInvInProjectWBS(mockReq, mockRes);

      assertResMock(200, inventory, response, mockRes);
    });
  });

  describe('postInvInProjectWBS', () => {
    test("Ensure postInvInProjectWBS Returns error 403 if the user doesn't have the postInvInProjectWBS permission", async () => {
      const { postInvInProjectWBS } = inventoryController(
        inventoryItem,
        inventoryItemType,
        projects,
      );
      const hasPermissionSpy = mockHasPermission(false);
      const response = await postInvInProjectWBS(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postInvInProjectWBS');
      assertResMock(403, 'You are not authorized to view inventory data.', response, mockRes);
    });

    test('Ensure postInvInProjectWBS Returns error 400 if valid project, but quantity and id are necessary as well as valid wbs if sent in and not Unassigned', async () => {
      const { postInvInProjectWBS } = inventoryController(
        inventoryItem,
        inventoryItemType,
        projects,
      );
      mockHasPermission(true);
      mockReq.body.quantity = 1;
      mockReq.body.typeId = '';

      jest.spyOn(projects, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve([]),
        }),
      });
      jest.spyOn(wbs, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve([]),
        }),
      });
      jest
        .spyOn(inventoryItem, 'find')
        .mockImplementationOnce(() =>
          Promise.reject(
            new Error(
              'Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned',
            ),
          ),
        );

      const response = await postInvInProjectWBS(mockReq, mockRes);

      assertResMock(
        400,
        'Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned',
        response,
        mockRes,
      );
    });

    test('Ensure postInvInProjectWBS Returns error 500 if saving an inventoryItem occurs', async () => {
      const { postInvInProjectWBS } = inventoryController(
        inventoryItem,
        inventoryItemType,
        projects,
      );
      mockHasPermission(true);
      mockReq.body.quantity = 1;
      mockReq.body.typeId = '6515fcc71dd1dbff0999e156';
      mockReq.body.wbsId = '6515fcc71dd1dbff0999e156';
      mockReq.body.projectId = '6515fcc71dd1dbff0999e156';
      mockReq.body.cost = 400;
      mockReq.body.poNum = '1234';

      jest.spyOn(projects, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve([]),
        }),
      });
      jest.spyOn(wbs, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve([]),
        }),
      });
      jest.spyOn(inventoryItem, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => null,
        }),
      });
      jest
        .spyOn(inventoryItem.prototype, 'save')
        .mockImplementationOnce(() => Promise.reject(new Error('an error occured')));

      const response = await postInvInProjectWBS(mockReq, mockRes);
      await flushPromises();
      assertResMock(500, new Error('an error occured'), response, mockRes);
    });

    test("Ensure postInvInProjectWBS Receives a 201 if an inventory item doesn't exist and is sucessfully created", async () => {
      const { postInvInProjectWBS } = inventoryController(
        inventoryItem,
        inventoryItemType,
        projects,
      );
      mockHasPermission(true);
      mockReq.body.quantity = 1;
      mockReq.body.typeId = '6515fcc71dd1dbff0999e156';
      mockReq.body.wbsId = '6515fcc71dd1dbff0999e156';
      mockReq.body.projectId = '6515fcc71dd1dbff0999e156';
      mockReq.body.cost = 400;
      mockReq.body.poNum = '1234';

      jest.spyOn(projects, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve([]),
        }),
      });
      jest.spyOn(wbs, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve([]),
        }),
      });
      jest.spyOn(inventoryItem, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => null,
        }),
      });

      const resolvedInventoryItem = new inventoryItem({
        project: mockReq.body.projectId,
        wbs: mockReq.body.wbsId,
        type: mockReq.body.typeId,
        quantity: mockReq.body.quantity,
        cost: mockReq.body.cost,
        poNum: mockReq.body.poNum,
      });

      jest
        .spyOn(inventoryItem.prototype, 'save')
        .mockImplementationOnce(() => Promise.resolve(resolvedInventoryItem));
      jest
        .spyOn(projects, 'findByIdAndUpdate')
        .mockImplementationOnce(() =>
          Promise.resolve({ _id: 'mockedProjectId', inventoryModifiedDatetime: Date.now() }),
        );

      const response = await postInvInProjectWBS(mockReq, mockRes);
      await flushPromises();
      assertResMock(201, resolvedInventoryItem, response, mockRes);
    });

    test('Ensure postInvInProjectWBS Receives a 201 if an inventory item does exist and is updated with new values', async () => {
      const { postInvInProjectWBS } = inventoryController(
        inventoryItem,
        inventoryItemType,
        projects,
      );
      mockHasPermission(true);
      mockReq.body.quantity = 1;
      mockReq.body.typeId = '6515fcc71dd1dbff0999e156';
      mockReq.body.wbsId = 'Unassigned';
      mockReq.body.projectId = '';
      mockReq.body.cost = 400;
      mockReq.body.poNum = '1234';

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

      jest.spyOn(projects, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve([]),
        }),
      });
      jest.spyOn(wbs, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve([]),
        }),
      });
      jest.spyOn(inventoryItem, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => resolvedInventoryItem,
        }),
      });
      jest
        .spyOn(inventoryItem, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(resolvedInventoryItem));
      jest
        .spyOn(inventoryItem, 'findByIdAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(updatedResolvedInventoryItem));
      jest
        .spyOn(projects, 'findByIdAndUpdate')
        .mockImplementationOnce(() =>
          Promise.resolve({ _id: 'mockedProjectId', inventoryModifiedDatetime: Date.now() }),
        );

      const response = await postInvInProjectWBS(mockReq, mockRes);
      await flushPromises();
      assertResMock(201, updatedResolvedInventoryItem, response, mockRes);
    });
  });
});
