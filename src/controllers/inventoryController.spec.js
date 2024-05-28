/* eslint-disable */
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

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

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

      const response = await postInvInProjectWBS(mockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postInvInProjectWBS');
      assertResMock(201, updatedResolvedInventoryItem, response, mockRes);
    });
  });
});

// mockReq.body.typeId ='6515fcc71dd1dbff0999e156'
