/* eslint-disable new-cap */

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(), // Mocking the hasPermission function
}));
const { mockReq, mockRes, assertResMock } = require('../test');

const inventoryItem = require('../models/inventoryItem');
const inventoryItemType = require('../models/inventoryItemType');
const inventoryController = require('./inventoryController');
const projects = require('../models/project');
const wbs = require('../models/wbs');

const { hasPermission } = require('../utilities/permissions');

const makeSut = () => {
  const { getAllInvInProjectWBS, postInvInProjectWBS, getAllInvInProject } = inventoryController(
    inventoryItem,
    inventoryItemType,
  );
  return { getAllInvInProjectWBS, postInvInProjectWBS, getAllInvInProject };
};

const flushPromises = () => new Promise(setImmediate);

describe('Unit test for inventoryController', () => {
  beforeAll(() => {
    jest.clearAllMocks();
  });
  beforeEach(() => {
    mockReq.params.userid = '5a7e21f00317bc1538def4b7';
    mockReq.params.userId = '5a7e21f00317bc1538def4b7';
    mockReq.params.wbsId = '5a7e21f00317bc1538def4b7';
    mockReq.params.projectId = '5a7e21f00317bc1538def4b7';
    mockReq.body = {
      project: '5a7e21f00317bc1538def4b7',
      wbs: '5a7e21f00317bc1538def4b7',
      itemType: '5a7e21f00317bc1538def4b7',
      item: '5a7e21f00317bc1538def4b7',
      quantity: 1,
      typeId: '5a7e21f00317bc1538def4b7',
      cost: 20,
      poNum: '123',
    };
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('getAllInvInProjectWBS', () => {
    test('Returns 403 if user is not authorized to view inventory data', async () => {
      const { getAllInvInProjectWBS } = makeSut();
      hasPermission.mockResolvedValue(false);
      const response = await getAllInvInProjectWBS(mockReq, mockRes);
      assertResMock(403, 'You are not authorized to view inventory data.', response, mockRes);
      expect(hasPermission).toHaveBeenCalledTimes(1);
    });

    test('Returns 404 if an error occurs while fetching inventory data', async () => {
      const { getAllInvInProjectWBS } = makeSut();
      // Mocking hasPermission function
      hasPermission.mockResolvedValue(true);

      // Mock error
      const error = new Error('Error fetching inventory data');

      // Mock chainable methods: populate, sort, then, catch
      const mockInventoryItem = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementationOnce(() => Promise.reject(error)),
        catch: jest.fn().mockReturnThis(),
      };

      // Mock the inventoryItem.find method
      jest.spyOn(inventoryItem, 'find').mockImplementationOnce(() => mockInventoryItem);

      // Call the function
      const response = await getAllInvInProjectWBS(mockReq, mockRes);
      await flushPromises();

      // Assertions
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(404, error, response, mockRes);
    });

    test('Returns 200 if successfully found data', async () => {
      const { getAllInvInProjectWBS } = makeSut();
      hasPermission.mockResolvedValue(true);

      const mockData = [
        {
          _id: '123',
          project: '123',
          wbs: '123',
          itemType: '123',
          item: '123',
          quantity: 1,
          date: new Date().toISOString(),
        },
      ];

      const mockInventoryItem = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockData),
        then: jest.fn().mockResolvedValue(() => {}),
        catch: jest.fn().mockReturnThis(),
      };

      // Mock the inventoryItem.find method
      jest.spyOn(inventoryItem, 'find').mockImplementation(() => mockInventoryItem);

      // Call the function
      const response = await getAllInvInProjectWBS(mockReq, mockRes);
      await flushPromises();

      // Assertions
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(200, mockData, response, mockRes);
    });
  });
  describe('postInvInProjectWBS', () => {
    test('Returns error 403 if the user is not authorized to view data', async () => {
      const { getAllInvInProjectWBS } = makeSut();
      hasPermission.mockReturnValue(false);
      const response = await getAllInvInProjectWBS(mockReq, mockRes);
      assertResMock(403, 'You are not authorized to view inventory data.', response, mockRes);
      expect(hasPermission).toHaveBeenCalledTimes(1);
    });

    test('Returns error 400 if an error occurs while fetching an item', async () => {
      mockReq.params.wbsId = 'Unassigned';
      const { postInvInProjectWBS } = makeSut();
      hasPermission.mockReturnValue(true);
      // look up difference betewewen mockimplmenonce and mockimplementation
      // how to incorpoate into the test
      // and how to setup mocking variables as well
      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValue(null),
      };

      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);

      const response = await postInvInProjectWBS(mockReq, mockRes);
      await flushPromises();

      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(
        400,
        'Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned',
        response,
        mockRes,
      );
    });
    test('Returns error 500 if an error occurs when saving', async () => {
      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockWbsExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockInventoryItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValue(null),
      };
      const { postInvInProjectWBS } = makeSut();
      // const hasPermissionSpy = mockHasPermission(true);
      hasPermission.mockReturnValue(true);

      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);
      jest.spyOn(wbs, 'findOne').mockImplementationOnce(() => mockWbsExists);
      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => mockInventoryItem);

      jest.spyOn(inventoryItem.prototype, 'save').mockRejectedValueOnce(new Error('Error saving'));
      const response = await postInvInProjectWBS(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(500, new Error('Error saving'), response, mockRes);
    });

    test('Receives a 201 success if the inventory was successfully created and saved', async () => {
      const resolvedInventoryItem = new inventoryItem({
        project: mockReq.body.projectId,
        wbs: mockReq.body.wbsId,
        type: mockReq.body.typeId,
        quantity: mockReq.body.quantity,
        cost: mockReq.body.cost,
        poNum: mockReq.body.poNum,
      });
      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockWbsExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockInventoryItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValue(null),
      };
      const { postInvInProjectWBS } = makeSut();

      hasPermission.mockReturnValue(true);
      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);
      jest.spyOn(wbs, 'findOne').mockImplementationOnce(() => mockWbsExists);
      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => mockInventoryItem);
      jest
        .spyOn(inventoryItem.prototype, 'save')
        .mockImplementationOnce(() => Promise.resolve(resolvedInventoryItem));

      const response = await postInvInProjectWBS(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(201, resolvedInventoryItem, response, mockRes);
    });

    test('Returns a 201, if the inventory item was succesfully updated and saved.', async () => {
      const resolvedInventoryItem = {
        project: mockReq.body.projectId,
        wbs: mockReq.body.wbsId,
        type: mockReq.body.typeId,
        quantity: mockReq.body.quantity,
        cost: mockReq.body.cost,
        poNum: mockReq.body.poNum,
      };

      const updatedResolvedInventoryItem = {
        project: mockReq.body.projectId,
        wbs: mockReq.body.wbsId,
        type: mockReq.body.typeId,
        quantity: mockReq.body.quantity + 1,
        costPer: 200,
      };

      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockWbsExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockInventoryExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };

      const { postInvInProjectWBS } = makeSut();
      hasPermission.mockReturnValue(true);

      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);
      jest.spyOn(wbs, 'findOne').mockImplementationOnce(() => mockWbsExists);
      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => mockInventoryExists);
      jest
        .spyOn(inventoryItem, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(resolvedInventoryItem));

      jest
        .spyOn(inventoryItem, 'findByIdAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(updatedResolvedInventoryItem));

      const response = await postInvInProjectWBS(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(201, updatedResolvedInventoryItem, response, mockRes);
    });
  });
});
