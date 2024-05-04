const forcePwdcontroller = require('./forcePwdController');
const userProfile = require('../models/userProfile');
const { mockReq, mockRes, assertResMock } = require('../test');

const makeSut = () => {
  const { forcePwd } = forcePwdcontroller(userProfile);

  return {
    forcePwd,
  };
};

const flushPromises = () => new Promise(setImmediate);

describe('ForcePwdController Unit Tests', () => {
  beforeEach(() => {
    mockReq.body.userId = '65cf6c3706d8ac105827bb2e';
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
    const errorMsg = 'Error happened when finding user';
    jest.spyOn(userProfile, 'findById').mockImplementationOnce(() => Promise.reject(errorMsg));
    const response = forcePwd(mockReq, mockRes);
    await flushPromises();
    assertResMock(500, errorMsg, response, mockRes);
  });
});
