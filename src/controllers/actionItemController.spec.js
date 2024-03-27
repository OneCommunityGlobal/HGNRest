const actionItemController = require('./actionItemController');
const { mockReq, mockRes, assertResMock } = require('../test');

jest.mock('../helpers/notificationhelper');
const notificationhelper = require('../helpers/notificationhelper');

const ActionItem = require('../models/actionItem');

// Sut = Systems Under Test, aka the functions inside the controllers we are testing.
// this function creates the actionItemController then returns the individual functions inside the controller.
const makeSut = () => {
  const { postactionItem, getactionItem, deleteactionItem } = actionItemController(ActionItem);

  return {
    postactionItem,
    getactionItem,
    deleteactionItem,
  };
};

describe('Action Item Controller tests', () => {
  beforeAll(() => {
    notificationhelper.mockImplementation(() => ({
      notificationcreated: jest.fn(() => true),
      notificationedited: jest.fn(() => true),
      notificationdeleted: jest.fn(() => true),
    }));
  });

  beforeEach(() => {
    mockReq.params.userid = '5a7e21f00317bc1538def4b7';
    mockReq.params.actionItemId = '7d7e21f00317bc1538deabc2';
    mockReq.body.requestor = {
      requestorId: '5a7e21f00317bc1538def4b7',
      assignedTo: '5a7ccd20fde60f1f1857ba16',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postactionItem function', () => {
    test('Ensures postactionItem returns 400 if any error occurs during save.', async () => {
      const { postactionItem } = makeSut();
      const errorMsg = 'Error occured during save.';
      jest
        .spyOn(ActionItem.prototype, 'save')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));

      const response = await postactionItem(mockReq, mockRes);

      assertResMock(400, new Error(errorMsg), response, mockRes);
    });

    test('Returns 400 if notificationcreated method throws an error.', async () => {
      const errorMsg = 'Error occured in notificationcreated method';

      notificationhelper.mockImplementationOnce(() => ({
        notificationcreated: jest.fn(() => {
          throw new Error(errorMsg);
        }),
      }));

      const { postactionItem } = makeSut();

      const newActionItem = {
        _id: 'random123id',
      };

      jest
        .spyOn(ActionItem.prototype, 'save')
        .mockImplementationOnce(() => Promise.resolve(newActionItem));

      const response = await postactionItem(mockReq, mockRes);

      assertResMock(400, new Error(errorMsg), response, mockRes);
    });

    test('Returns 200 if postactionItem is saved correctly.', async () => {
      const { postactionItem } = makeSut();

      mockReq.body.description = 'Any description';
      mockReq.body.assignedTo = null;

      const newActionItem = {
        _id: 'random123id',
      };

      jest
        .spyOn(ActionItem.prototype, 'save')
        .mockImplementationOnce(() => Promise.resolve(newActionItem));

      const response = await postactionItem(mockReq, mockRes);

      assertResMock(
        200,
        {
          _id: newActionItem._id,
          createdBy: 'You',
          description: mockReq.body.description,
          assignedTo: mockReq.body.assignedTo,
        },
        response,
        mockRes,
      );
    });
  });

  describe('getactionItem function', () => {
    test('Returns 400 if any error occurs when finding an ActionItem.', async () => {
      const { getactionItem } = makeSut();
      const errorMsg = 'Error when finding action items';

      jest.spyOn(ActionItem, 'find').mockReturnValueOnce({
        populate: () => Promise.reject(new Error(errorMsg)),
      });

      const response = await getactionItem(mockReq, mockRes);

      assertResMock(400, new Error(errorMsg), response, mockRes);
    });

    test('Returns 200 if get actionItem successfully finds a matching ActionItem', async () => {
      const { getactionItem } = makeSut();
      const mockActionItems = [
        {
          _id: 'randomid123',
          description: 'Random description',
          assignedTo: 'randomuser123',
          createdBy: { firstName: 'Bob', lastName: 'Builder' },
          createdDateTime: new Date().toISOString(),
        },
      ];

      jest
        .spyOn(ActionItem, 'find')
        .mockReturnValueOnce({ populate: () => Promise.resolve(mockActionItems) });

      const returnValue = [
        {
          _id: mockActionItems[0]._id,
          description: mockActionItems[0].description,
          assignedTo: mockActionItems[0].assignedTo,
          createdBy: `${mockActionItems[0].createdBy.firstName} ${mockActionItems[0].createdBy.lastName}`,
        },
      ];

      const response = await getactionItem(mockReq, mockRes);
      assertResMock(200, returnValue, response, mockRes);
    });
  });

  describe('deleteactionItem function', () => {
    test('Returns 400 if any error occurs when finding an ActionItem', async () => {
      const { deleteactionItem } = makeSut();
      const errorMsg = 'Error when finding ActionItem';

      jest
        .spyOn(ActionItem, 'findById')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));

      const response = await deleteactionItem(mockReq, mockRes);

      assertResMock(400, new Error(errorMsg), response, mockRes);
    });

    test('Returns 400 if no ActionItem is found', async () => {
      const { deleteactionItem } = makeSut();
      const errorMsg = {
        message: 'No valid records found',
      };

      jest.spyOn(ActionItem, 'findById').mockImplementationOnce(() => Promise.resolve(null));

      const response = await deleteactionItem(mockReq, mockRes);

      assertResMock(400, errorMsg, response, mockRes);
    });

    test('Returns 400 if any error occurs when deleting an ActionItem', async () => {
      const { deleteactionItem } = makeSut();
      const errorMsg = 'Error when removing ActionItem';

      jest
        .spyOn(ActionItem, 'findById')
        .mockReturnValueOnce({ remove: () => Promise.reject(new Error(errorMsg)) });

      const response = await deleteactionItem(mockReq, mockRes);

      assertResMock(400, new Error(errorMsg), response, mockRes);
    });

    test('Returns 400 if notificationdeleted method throws an error.', async () => {
      const errorMsg = 'Error occured in notificationdeleted method';

      notificationhelper.mockImplementationOnce(() => ({
        notificationdeleted: jest.fn(() => {
          throw new Error(errorMsg);
        }),
      }));

      const { deleteactionItem } = makeSut();

      jest
        .spyOn(ActionItem, 'findById')
        .mockReturnValueOnce({ remove: () => Promise.resolve(true) });

      const response = await deleteactionItem(mockReq, mockRes);

      assertResMock(400, new Error(errorMsg), response, mockRes);
    });

    test('Returns 200 if get actionItem successfully finds and removes the matching ActionItem', async () => {
      const message = { message: 'removed' };

      const { deleteactionItem } = makeSut();

      jest
        .spyOn(ActionItem, 'findById')
        .mockReturnValueOnce({ remove: () => Promise.resolve(true) });

      const response = await deleteactionItem(mockReq, mockRes);

      assertResMock(200, message, response, mockRes);
    });
  });
});
