/* eslint-disable */
const { mockRes, mockReq, assertResMock } = require('../test');
const helper = require('../utilities/permissions');
const wbs = require('../models/wbs');
const { hasPermission } = require('../utilities/permissions');
const inventoryController = require('./inventoryController');
const inventoryItem = require('../models/inventoryItem');
const inventoryItemType = require('../models/inventoryItemType');
const mongoose = require('mongoose');

const makeSut = () => {
  const { getAllInvInProjectWBS } = inventoryController(inventoryItem, null);

  return {
    getAllInvInProjectWBS,
  };
};

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
});
