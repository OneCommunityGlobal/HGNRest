const { mockReq, mockRes, assertResMock } = require('../test');
const inventoryItem = require('../models/inventoryItem');
const inventoryItemType = require('../models/inventoryItemType');
const inventoryController = require('./inventoryController');
const helper = require('../utilities/permissions');

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

const makeSut = () => {
  const { getAllInvInProjectWBS } = inventoryController(inventoryItem, inventoryItemType);
  return { getAllInvInProjectWBS };
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
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('getAllInvInProjectWBS', () => {
    test('Returns 403 if user is not authorized to view inventory data', async () => {
      const { getAllInvInProjectWBS } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const response = await getAllInvInProjectWBS(mockReq, mockRes);
      assertResMock(403, 'You are not authorized to view inventory data.', response, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledTimes(1);
    });

    test('Returns 404 if an error occurs while fetching inventory data', async () => {
      const { getAllInvInProjectWBS } = makeSut();
      // Mocking hasPermission function
      const hasPermissionSpy = mockHasPermission(true);

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
      expect(hasPermissionSpy).toHaveBeenCalledTimes(1);
      assertResMock(404, error, response, mockRes);
    });

    test('Returns 200 if successfully found data', async () => {
      const { getAllInvInProjectWBS } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);

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
      expect(hasPermissionSpy).toHaveBeenCalledTimes(1);
      assertResMock(200, mockData, response, mockRes);
    });
  });
});
