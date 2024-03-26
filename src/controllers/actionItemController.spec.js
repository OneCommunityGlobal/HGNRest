const actionItemController = require('./actionItemController');
const {
  mockReq,
  mockRes,
  mongoHelper: { dbConnect, dbDisconnect },
  assertResMock,
} = require('../test');
// const notificationhelper = require('../helpers/notificationhelper')();
const ActionItem = require('../models/actionItem');

// Sut = Systems Under Test, aka the functions inside the controllers we are testing.
// this function creates the actionItemController then returns the individual functions inside the controller.
const makeSut = () => {
  const { postactionItem } = actionItemController(ActionItem);

  return {
    postactionItem,
  };
};

describe('Action Item Controller tests', () => {
  beforeAll(async () => {
    await dbConnect();
  });

  beforeEach(() => {
    mockReq.params.userid = '5a7e21f00317bc1538def4b7';
    mockReq.body.requestor = {
      requestorId: '5a7e21f00317bc1538def4b7',
      assignedTo: '5a7ccd20fde60f1f1857ba16',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await dbDisconnect();
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

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        _id: newActionItem._id,
        createdBy: 'You',
        description: mockReq.body.description,
        assignedTo: mockReq.body.assignedTo,
      });
      expect(response).toBeUndefined();
    });
  });
});
