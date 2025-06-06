const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bmLoginController = require('../bmLoginController');
const userprofile = require('../../../models/userProfile');
const config = require('../../../config');

jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('../../../models/userProfile');
jest.mock('../../../config', () => ({
  JWT_SECRET: 'test-secret',
}));

describe('bmLoginController', () => {
  const { bmLogin } = bmLoginController();

  let req, res;

  beforeEach(() => {
    req = {
      body: { email: 'test@example.com', password: 'password123' },
      headers: { authorization: 'Bearer mockToken' },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.clearAllMocks();

    jwt.verify = jest.fn();
    bcrypt.compare = jest.fn();
    jwt.sign = jest.fn();
    userprofile.findOne = jest.fn();
  });

  it('should return a new token if email and password match', async () => {
    const mockUser = { _id: '12345', email: 'test@example.com', password: 'hashedPassword' };
    const mockDecode = { userid: '12345' };

    jwt.verify.mockReturnValue(mockDecode);
    userprofile.findOne.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('newMockToken');

    await bmLogin(req, res);

    expect(jwt.verify).toHaveBeenCalledWith('Bearer mockToken', config.JWT_SECRET);
    expect(userprofile.findOne).toHaveBeenCalledWith({ _id: '12345' });
    expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
    expect(jwt.sign).toHaveBeenCalledWith(
      {
        ...mockDecode,
        access: {
          canAccessBMPortal: true,
        },
      },
      config.JWT_SECRET,
    );
    expect(res.json).toHaveBeenCalledWith({ token: 'newMockToken' });
  });

  it('should return 422 if email does not match', async () => {
    const mockUser = { _id: '12345', email: 'wrong@example.com', password: 'hashedPassword' };

    jwt.verify.mockReturnValue({ userid: '12345' });
    userprofile.findOne.mockResolvedValue(mockUser);

    await bmLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      label: 'email',
      message: 'Email must match current login. Please try again.',
    });
  });

  it('should return 422 if password does not match', async () => {
    const mockUser = { _id: '12345', email: 'test@example.com', password: 'hashedPassword' };

    jwt.verify.mockReturnValue({ userid: '12345' });
    userprofile.findOne.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(false);

    await bmLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      label: 'password',
      message: 'Password must match current login. Please try again.',
    });
  });

  it('should return an error if token is invalid', async () => {
    const error = new Error('Invalid token');
    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await bmLogin(req, res);

    expect(res.json).toHaveBeenCalledWith(error);
  });

  it('should return an error if user is not found', async () => {
    jwt.verify.mockReturnValue({ userid: '12345' });
    userprofile.findOne.mockResolvedValue(null);

    await bmLogin(req, res);
    expect(res.json).toHaveBeenCalled();
  });
});
