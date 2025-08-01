const forcePwdcontroller = require('./forcePwdController');
const userProfile = require('../models/userProfile');
const bcrypt = require('bcryptjs');
const { mockReq, mockRes, assertResMock } = require('../test');

const makeSut = () => {
  const { forcePwd } = forcePwdcontroller(userProfile);
  return { forcePwd };
};

const flushPromises = () => new Promise(setImmediate);

describe('ForcePwdController Unit Tests', () => {
  beforeEach(() => {
    mockReq.body.userId = '65cf6c3706d8ac105827bb2e';
    mockReq.body.newpassword = 'newPasswordReset';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Returns a 400 bad request status if userId is not valid with an error message Bad Request', async () => {
    const { forcePwd } = makeSut();
    const errorMsg = { error: 'Bad Request' };
    mockReq.body.userId = '';
    const response = await forcePwd(mockReq, mockRes);
    assertResMock(400, errorMsg, response, mockRes);
  });

  test('Returns a 500 Internal Error if finding userProfile throws an error', async () => {
    const { forcePwd } = makeSut();
    const errorMsg = { "error": "Error happened when finding user" };
    jest.spyOn(userProfile, 'findById')
      .mockImplementationOnce(() => Promise.reject(errorMsg));
    await forcePwd(mockReq, mockRes);

    assertResMock(500, errorMsg, undefined, mockRes);

  });

  test('Returns a 200 OK status with a success message "password Reset"', async () => {
    const { forcePwd } = makeSut();
    const successMsg = { message: 'password Reset' };

    // Mock bcrypt.compare to resolve false so we go down the "save" path
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    // Provide a fake hashed password on the user
    const mockUser = {
      password: 'fakeHash',
      set: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };

    jest.spyOn(userProfile, 'findById').mockResolvedValue(mockUser);

    await forcePwd(mockReq, mockRes); // Await the function call

    assertResMock(200, successMsg, undefined, mockRes); // Ensure the response is mocked correctly
  });
  test('Returns a 500 Internal Error status if new password fails to save', async () => {
    const { forcePwd } = makeSut();
    const errorMsg = { "error": "Error happened when saving user" };
    const mockUser = {
      set: jest.fn(),
      save: jest.fn().mockRejectedValue(errorMsg),
    };

    jest.spyOn(userProfile, 'findById').mockResolvedValue(mockUser);

    const response = await forcePwd(mockReq, mockRes);
    await flushPromises();
    assertResMock(500, errorMsg, response, mockRes);
  });
});
