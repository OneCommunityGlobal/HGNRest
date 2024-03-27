const logincontroller = require('./logincontroller');
const { mockReq, mockRes, assertResMock } = require('../test');

const makeSut = () => {
  const { login, getUser } = logincontroller();
  return {
    login,
    getUser,
  };
};

describe('logincontroller module', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe.only('login', () => {
    test.only('Ensure login returns error 400 if there is no email or password', async () => {
      const { login } = makeSut();
      const mockReqModified = {
        ...mockReq,
        ...{
          body: {
            email: 'hello@gmail.com',
            password: '',
          },
        },
      };
      // console.log("REQ MOD ", mockReqModified)
      const res = await login(mockReqModified, mockRes);
      assertResMock(400, { error: 'Invalid request' }, res, mockRes);
    });
  });

  describe('getUser', () => {
    it('Ensure getUser returns 200, with the requestor body', () => {
      const { getUser } = makeSut();

      const res = getUser(mockReq, mockRes);
      assertResMock(200, mockReq.body.requestor, res, mockRes);
    });
  });
});
