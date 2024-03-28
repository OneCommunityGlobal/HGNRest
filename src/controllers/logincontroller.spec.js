const logincontroller = require('./logincontroller');
const { mockReq, mockRes, assertResMock, mockUser } = require('../test');
const userProfile = require('../models/userProfile');

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
    test('Ensure login returns error 400 if there is no email or password', async () => {
      const { login } = makeSut();
      const mockReqModified = {
        ...mockReq,
        ...{
          body: {
            email: '',
            password: '',
          },
        },
      };
      const res = await login(mockReqModified, mockRes);
      assertResMock(400, { error: 'Invalid request' }, res, mockRes);
    });

    test('Ensure login returns error 403 if there is no user', async () => {
      const { login } = makeSut();
      const mockReqModified = {
        ...mockReq,
        ...{
          body: {
            email: 'example@test.com',
            password: 'exampletest',
          },
        },
      };
      const findOneSpy = jest
        .spyOn(userProfile, 'findOne')
        .mockImplementation(() => Promise.resolve(null));

      const res = await login(mockReqModified, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({ email: mockReqModified.body.email });
      assertResMock(403, { message: 'Username not found.' }, res, mockRes);
    });

    test.only('Ensure login returns error 403 if the user exists but is not active', async () => {
      const { login } = makeSut();
      const mockReqModified = {
        ...mockReq,
        ...{
          body: {
            email: 'example@test.com',
            password: 'exampletest',
          },
        },
      };
      const mockUserModified = {
        ...mockUser,
        ...{
          isActive: false,
        },
      };

      const findOneSpy = jest
        .spyOn(userProfile, 'findOne')
        .mockImplementation(() => Promise.resolve(mockUserModified));

      const res = await login(mockReqModified, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({ email: mockReqModified.body.email });
      assertResMock(
        403,
        {
          message:
            'Sorry, this account is no longer active. If you feel this is in error, please contact your Manager and/or Administrator.',
        },
        res,
        mockRes,
      );
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
