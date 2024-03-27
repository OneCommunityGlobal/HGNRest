const logincontroller = require('./logincontroller');
const { mockReq, mockRes, assertResMock } = require('../test');

const makeSut = () => {
  const { getUser } = logincontroller();
  return {
    getUser,
  };
};

describe('logincontroller module', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    it('Ensure getUser returns 200, with the requestor body', () => {
      const { getUser } = makeSut();
      const res = getUser(mockReq, mockRes);
      assertResMock(200, mockReq.body.requestor, res, mockRes);
    });
  });
});
