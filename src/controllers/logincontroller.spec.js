const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
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

describe.only('logincontroller module', () => {
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

    test('Ensure login returns error 403 if the user exists but is not active', async () => {
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

    test.only('Ensure login returns error 403 if the password is not a match and if the user already exists', async () => {
      const { login } = makeSut();
      const mockReqModified = {
        ...mockReq,
        ...{
          body: {
            email: 'example@test.com',
            password: 'SuperSecretPassword@',
          },
        },
      };

      const findOneSpy = jest
        .spyOn(userProfile, 'findOne')
        .mockImplementation(() => Promise.resolve(mockUser));
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      const res = await login(mockReqModified, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({ email: mockReqModified.body.email });

      assertResMock(
        403,
        {
          message: 'Invalid password.',
        },
        res,
        mockRes,
      );
    });

    test('Ensure login returns the error if the try block fails', async () => {
      const { login } = makeSut();
      const error = new Error('Try block failed');
      const mockReqModified = {
        ...mockReq,
        ...{
          body: {
            email: 'example@test.com',
            password: 'exampletest',
          },
        },
      };

      jest.spyOn(userProfile, 'findOne').mockImplementation(() => Promise.reject(error));

      await login(mockReqModified, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith(error);
    });

    test('Ensure login returns 200, if the user is a new user and there is a password match', async () => {
      const { login } = makeSut();
      const mockReqModified = {
        ...mockReq,
        ...{
          body: {
            email: 'example@example.com',
            password: '123Welcome!',
          },
        },
      };

      const mockUserModified = {
        _id: 'user123',
        email: 'example@example.com',
        password: 'hashedPassword',
        resetPwd: 'newUserPassword',
        isActive: true,
      };

      jest
        .spyOn(userProfile, 'findOne')
        .mockImplementation(() => Promise.resolve(mockUserModified));

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const res = await login(mockReqModified, mockRes);
      assertResMock(200, { new: true, userId: 'user123' }, res, mockRes);
    });

    // Failing Test 2
    test.only('Ensure login returns 200, if the user already exists and the password is a match', async () => {
      const { login } = makeSut();
      const mockReqModified = {
        ...mockReq,
        body: {
          email: 'existing@example.com',
          password: 'existingUserPassword',
        },
      };
      const mockUserModified = {
        _id: 'user123',
        email: 'existing@example.com',
        password: 'hashedPassword',
        resetPwd: 'newUserPassword',
        isActive: true,
        role: 'Volunteer',
        permissions: ['read', 'write'],
      };

      const findOneSpy = jest
        .spyOn(userProfile, 'findOne')
        .mockImplementation(() => Promise.resolve(mockUserModified));

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const res = await login(mockReqModified, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({ email: mockReqModified.body.email });

      assertResMock(200, { token: expect.any(String) }, res, mockRes);
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
