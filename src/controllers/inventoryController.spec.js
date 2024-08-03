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
  const {
    getAllInvInProjectWBS,
    postInvInProjectWBS,
    getAllInvInProject,
    postInvInProject,
    transferInvById,
  } = inventoryController(inventoryItem, inventoryItemType);
  return {
    getAllInvInProjectWBS,
    postInvInProjectWBS,
    getAllInvInProject,
    postInvInProject,
    transferInvById,
  };
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
    mockReq.params.invId = '5a7e21f00317bc1538def4b7';
    mockReq.body = {
      project: '5a7e21f00317bc1538def4b7',
      projectId: '5a7e21f00317bc1538def4b7',
      wbs: '5a7e21f00317bc1538def4b7',
      itemType: '5a7e21f00317bc1538def4b7',
      item: '5a7e21f00317bc1538def4b7',
      typeId: '5a7e21f00317bc1538def4b7',
      quantity: 11,
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

  describe('getAllInvInProject', () => {
    test('Returns 403 if user is not authorized to view inventory data', async () => {
      const { getAllInvInProject } = makeSut();
      hasPermission.mockResolvedValue(false);
      const response = await getAllInvInProject(mockReq, mockRes);
      assertResMock(403, 'You are not authorized to view inventory data.', response, mockRes);
      expect(hasPermission).toHaveBeenCalledTimes(1);
    });

    test('Returns 404 if an error occurs while fetching inventory data', async () => {
      const { getAllInvInProject } = makeSut();
      hasPermission.mockResolvedValue(true);

      const error = new Error('Error fetching inventory data');

      const mockInventoryItem = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementationOnce(() => Promise.reject(error)),
        catch: jest.fn().mockReturnThis(),
      };

      jest.spyOn(inventoryItem, 'find').mockImplementationOnce(() => mockInventoryItem);

      const response = await getAllInvInProject(mockReq, mockRes);
      await flushPromises();

      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(404, error, response, mockRes);
    });

    test('Returns 200 if successfully found data', async () => {
      const { getAllInvInProject } = makeSut();
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
        catch: jest.fn().mockReturnThis(),
      };

      jest.spyOn(inventoryItem, 'find').mockImplementation(() => mockInventoryItem);

      const response = await getAllInvInProject(mockReq, mockRes);
      await flushPromises();

      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(200, mockData, response, mockRes);
    });
  });

  describe('postInvInProject', () => {
    test('Returns error 403 if the user is not authorized to view data', async () => {
      const { postInvInProject } = makeSut();
      hasPermission.mockReturnValue(false);
      const response = await postInvInProject(mockReq, mockRes);
      assertResMock(403, 'You are not authorized to post new inventory data.', response, mockRes);
      expect(hasPermission).toHaveBeenCalledTimes(1);
    });

    test('Returns error 400 if an error occurs while fetching an item', async () => {
      const { postInvInProject } = makeSut();
      hasPermission.mockReturnValue(true);
      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValue(null),
      };
      const mockTypeItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValue(null),
      };

      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);
      jest.spyOn(inventoryItemType, 'findOne').mockImplementationOnce(() => mockTypeItem);
      const response = await postInvInProject(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(400, 'Valid Project, Quantity and Type Id are necessary', response, mockRes);
    });
    test('Returns error 500 if an error occurs when saving', async () => {
      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockTypeItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockInventoryItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValue(null),
      };
      const { postInvInProject } = makeSut();
      hasPermission.mockReturnValue(true);

      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);
      jest.spyOn(inventoryItemType, 'findOne').mockImplementationOnce(() => mockTypeItem);
      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => mockInventoryItem);

      jest.spyOn(inventoryItem.prototype, 'save').mockRejectedValueOnce(new Error('Error saving'));
      const response = await postInvInProject(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(500, new Error('Error saving'), response, mockRes);
    });
    test('Returns 500 if an error occurs when updating an inventory item', async () => {
      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockTypeItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockInventoryItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };

      const resolvedInventoryItem = {
        project: '5a7e21f00317bc1538def4b7', // '5a7e21f00317bc1538def4b7
        wbs: mockReq.body.wbsId,
        type: mockReq.body.typeId,
        quantity: mockReq.body.quantity,
        cost: mockReq.body.cost,
        poNum: mockReq.body.poNum,
      };
      const { postInvInProject } = makeSut();
      hasPermission.mockReturnValue(true);

      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);
      jest.spyOn(inventoryItemType, 'findOne').mockImplementationOnce(() => mockTypeItem);
      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => mockInventoryItem);
      jest
        .spyOn(inventoryItem, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(resolvedInventoryItem));

      jest
        .spyOn(inventoryItem, 'findByIdAndUpdate')
        .mockRejectedValueOnce(new Error('error occured'));

      const response = await postInvInProject(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(500, new Error('error occured'), response, mockRes);
    });

    test('Returns 201 if succesfully saved data to database', async () => {
      const { postInvInProject } = makeSut();

      const mockSavedItem = {
        project: mockReq.body.projectId,
        wbs: mockReq.body.wbsId,
        type: mockReq.body.typeId,
        quantity: mockReq.body.quantity,
        cost: mockReq.body.cost,
        poNum: mockReq.body.poNum,
      };
      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockTypeItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockInventoryItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValue(null),
      };
      hasPermission.mockReturnValue(true);

      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);
      jest.spyOn(inventoryItemType, 'findOne').mockImplementationOnce(() => mockTypeItem);
      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => mockInventoryItem);

      jest.spyOn(inventoryItem.prototype, 'save').mockResolvedValueOnce(mockSavedItem); // mockResolvedValueOnce(new inventoryItem({}));'

      const response = await postInvInProject(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(201, mockSavedItem, response, mockRes);
    });

    test('Returns a 201, if the inventory item was succesfully updated and saved.', async () => {
      const { postInvInProject } = makeSut();

      const mockSavedItem = {
        project: mockReq.body.projectId,
        wbs: mockReq.body.wbsId,
        type: mockReq.body.typeId,
        quantity: mockReq.body.quantity,
        cost: mockReq.body.cost,
        poNum: mockReq.body.poNum,
      };
      const mockUpdatedItem = {
        project: mockReq.body.projectId,
        wbs: mockReq.body.wbsId,
        type: mockReq.body.typeId,
        quantity: mockReq.body.quantity,
        cost: mockReq.body.cost,
        poNum: mockReq.body.poNum,
        costPer: 250,
      };
      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockTypeItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockInventoryItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      hasPermission.mockReturnValue(true);

      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);
      jest.spyOn(inventoryItemType, 'findOne').mockImplementationOnce(() => mockTypeItem);
      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => mockInventoryItem);

      jest.spyOn(inventoryItem, 'findOneAndUpdate').mockResolvedValueOnce(mockSavedItem);
      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce(mockUpdatedItem);

      const response = await postInvInProject(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(201, mockUpdatedItem, response, mockRes);
    });
  });

  describe('transferInvById', () => {
    test('Returns 403 if user is not authorized to view inventory data', async () => {
      const { transferInvById } = makeSut();
      hasPermission.mockResolvedValue(false);
      const response = await transferInvById(mockReq, mockRes);
      assertResMock(403, 'You are not authorized to transfer inventory data.', response, mockRes);
      expect(hasPermission).toHaveBeenCalledTimes(1);
    });
    test('Returns 400 if the invenotry id provided does not have enough quantity to transfer.', async () => {
      const { transferInvById } = makeSut();
      hasPermission.mockResolvedValue(true);
      const mockInventoryItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValue(null),
      };
      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => mockInventoryItem);
      const response = await transferInvById(mockReq, mockRes);
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(
        400,
        'You must send a valid Inventory Id with enough quantity that you requested to be transfered.',
        response,
        mockRes,
      );
    });

    test('Returns 400 if an invalid project, quanity and type id are passed.', async () => {
      const { transferInvById } = makeSut();
      hasPermission.mockResolvedValue(true);
      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      }));

      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      }));
      jest.spyOn(wbs, 'findOne').mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValue(null),
      }));

      mockReq.body.quantity = 0;
      const response = await transferInvById(mockReq, mockRes);
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(
        400,
        'Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned',
        response,
        mockRes,
      );
    });

    test('Returns 500 if an error occurs when searching and updating an item in the database', async () => {
      const { transferInvById } = makeSut();
      hasPermission.mockResolvedValue(true);
      const mockInventoryItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockWbsExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => mockInventoryItem);
      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);
      jest.spyOn(wbs, 'findOne').mockImplementationOnce(() => mockWbsExists);
      jest
        .spyOn(inventoryItem, 'findByIdAndUpdate')
        .mockRejectedValueOnce(new Error('Error saving'));
      const response = await transferInvById(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(500, new Error('Error saving'), response, mockRes);
    });

    test('Returns 500 if an error occurs when searching for an item', async () => {
      const { transferInvById } = makeSut();
      hasPermission.mockResolvedValue(true);
      const resolvedInventoryItem = {
        project: '5a7e21f00317bc1538def4b7',
        wbs: '5a7e21f00317bc1538def4b7',
        type: '5a7e21f00317bc1538def4b7',
        quantity: 1,
        cost: 20,
        poNum: '123',
      };

      const mockInventoryItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockWbsExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };

      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => mockInventoryItem);
      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);
      jest.spyOn(wbs, 'findOne').mockImplementationOnce(() => mockWbsExists);
      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce(resolvedInventoryItem);
      jest.spyOn(inventoryItem, 'findOne').mockRejectedValueOnce(new Error('Error searching'));
      const response = await transferInvById(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(500, new Error('Error searching'), response, mockRes);
    });
    test('Returns 500 if an error occurs when saving a new item to the database', async () => {
      const { transferInvById } = makeSut();
      hasPermission.mockResolvedValue(true);
      const resolvedInventoryItem = {
        project: '5a7e21f00317bc1538def4b7',
        wbs: '5a7e21f00317bc1538def4b7',
        type: '5a7e21f00317bc1538def4b7',
        quantity: 1,
        cost: 20,
        poNum: '123',
      };

      const mockInventoryItem = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockProjectExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };
      const mockWbsExists = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      };

      jest.spyOn(inventoryItem, 'findOne').mockImplementationOnce(() => mockInventoryItem);
      jest.spyOn(projects, 'findOne').mockImplementationOnce(() => mockProjectExists);
      jest.spyOn(wbs, 'findOne').mockImplementationOnce(() => mockWbsExists);
      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce(resolvedInventoryItem);
      jest.spyOn(inventoryItem, 'findOne').mockResolvedValueOnce(null);

      jest
        .spyOn(inventoryItem.prototype, 'save')
        .mockRejectedValueOnce(new Error('Error creating new item'));

      const response = await transferInvById(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(500, new Error('Error creating new item'), response, mockRes);
    });
    test(' Returns 500 if an error occurs when a newItem is found and findByIdAndUpdate fails', async () => {
      const { transferInvById } = makeSut();
      hasPermission.mockResolvedValue(true);

      const resolvedInventoryItem = {
        project: '5a7e21f00317bc1538def4b7',
        wbs: '5a7e21f00317bc1538def4b7',
        type: '5a7e21f00317bc1538def4b7',
        quantity: 0,
        cost: 20,
        costPer: 200,
        _id: '5a7e21f00317bc1538def4b7',
      };
      jest.spyOn(inventoryItem, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });

      jest.spyOn(projects, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });
      jest.spyOn(wbs, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });
      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce(resolvedInventoryItem);

      jest.spyOn(inventoryItem, 'findOne').mockResolvedValueOnce(resolvedInventoryItem);
      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce({
        ...resolvedInventoryItem,
        cost: 200,
      });
      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce({
        quantity: 3,
        cost: 20,
      });
      jest
        .spyOn(inventoryItem, 'findByIdAndUpdate')
        .mockRejectedValueOnce(new Error('error occured'));

      const response = await transferInvById(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(500, new Error('error occured'), response, mockRes);
    });
    test(' Returns 500 if an error occurs when a newItem is found and findByIdAndUpdate fails', async () => {
      const { transferInvById } = makeSut();
      hasPermission.mockResolvedValue(true);

      const resolvedInventoryItem = {
        project: '5a7e21f00317bc1538def4b7',
        wbs: '5a7e21f00317bc1538def4b7',
        type: '5a7e21f00317bc1538def4b7',
        quantity: 0,
        cost: 20,
        costPer: 200,
        _id: '5a7e21f00317bc1538def4b7',
      };
      jest.spyOn(inventoryItem, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });

      jest.spyOn(projects, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });
      jest.spyOn(wbs, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });
      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce(resolvedInventoryItem);

      jest.spyOn(inventoryItem, 'findOne').mockResolvedValueOnce(resolvedInventoryItem);
      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce({
        ...resolvedInventoryItem,
        cost: 200,
      });
      jest
        .spyOn(inventoryItem, 'findByIdAndUpdate')
        .mockRejectedValueOnce(new Error('error occured'));

      const response = await transferInvById(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(500, new Error('error occured'), response, mockRes);
    });

    test('Returns 201 if saving and updating an inventory item was successful', async () => {
      const { transferInvById } = makeSut();
      hasPermission.mockResolvedValue(true);
      const resolvedInventoryItem = {
        project: '5a7e21f00317bc1538def4b7',
        wbs: '5a7e21f00317bc1538def4b7',
        type: '5a7e21f00317bc1538def4b7',
        quantity: 0,
        cost: 20,
        costPer: 200,
        _id: '5a7e21f00317bc1538def4b7',
      };
      jest.spyOn(inventoryItem, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });
      jest.spyOn(projects, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });
      jest.spyOn(wbs, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });

      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce(resolvedInventoryItem);
      jest.spyOn(inventoryItem, 'findOne').mockResolvedValueOnce(resolvedInventoryItem);
      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce({
        ...resolvedInventoryItem,
        cost: 200,
      });
      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce({
        quantity: 3,
        cost: 20,
      });

      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce(resolvedInventoryItem);

      const response = await transferInvById(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(201, resolvedInventoryItem, response, mockRes);
    });

    test('Returns 201 if it was sucessful in creating a new item and saving.', async () => {
      const { transferInvById } = makeSut();
      hasPermission.mockResolvedValue(true);
      const resolvedInventoryItem = {
        project: '5a7e21f00317bc1538def4b7',
        wbs: '5a7e21f00317bc1538def4b7',
        type: '5a7e21f00317bc1538def4b7',
        quantity: 0,
        cost: 20,
        costPer: 20,
        _id: '5a7e21f00317bc1538def4b7',
      };

      const mockInventoryItem = {
        quantity: 0,
        cost: 400,
        poNums: '123',
        inventoryItemType: '5a7e21f00317bc1538def4b7',
        project: '5a7e21f00317bc1538def4b7',
        wbs: '5a7e21f00317bc1538def4b7',
      };

      jest.spyOn(inventoryItem, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });
      jest.spyOn(projects, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });
      jest.spyOn(wbs, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
      });

      jest.spyOn(inventoryItem, 'findByIdAndUpdate').mockResolvedValueOnce(resolvedInventoryItem);
      jest.spyOn(inventoryItem, 'findOne').mockResolvedValueOnce(null);

      jest.spyOn(inventoryItem.prototype, 'save').mockResolvedValueOnce(mockInventoryItem);

      const response = await transferInvById(mockReq, mockRes);
      await flushPromises();
      expect(hasPermission).toHaveBeenCalledTimes(1);
      assertResMock(201, { from: resolvedInventoryItem, to: mockInventoryItem }, response, mockRes);
    });
  });
});
