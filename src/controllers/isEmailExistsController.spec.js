// tests/isEmailExistsController.test.js
// IMPORTANT: mock BEFORE requiring the model
jest.mock('../models/userProfile');

const isEmailExistsController = require('./isEmailExistsController');

const UserProfile = require('../models/userProfile');

describe('isEmailExistsController', () => {
  const { isEmailExists } = isEmailExistsController();

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.send = jest.fn();
    return res;
  };

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('should return 200 and message if email is found', async () => {
    const req = { params: { email: 'found@example.com' } };
    const res = mockRes();

    // mock findOne().lean().exec()
    const mockExec = jest.fn().mockResolvedValue({ email: 'found@example.com' });
    const mockLean = jest.fn().mockReturnValue({ exec: mockExec });
    const mockFindOne = jest.fn().mockReturnValue({ lean: mockLean });

    UserProfile.findOne = mockFindOne;

    await isEmailExists(req, res);

    expect(UserProfile.findOne).toHaveBeenCalledWith({ email: 'found@example.com' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('Email, found@example.com, found.');
  });

  it('should return 403 and message if email is not found', async () => {
    const req = { params: { email: 'missing@example.com' } };
    const res = mockRes();

    const mockExec = jest.fn().mockResolvedValue(null);
    const mockLean = jest.fn().mockReturnValue({ exec: mockExec });
    const mockFindOne = jest.fn().mockReturnValue({ lean: mockLean });

    UserProfile.findOne = mockFindOne;

    await isEmailExists(req, res);

    expect(UserProfile.findOne).toHaveBeenCalledWith({ email: 'missing@example.com' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith('Email, missing@example.com, not found.');
  });

  it('should handle errors (log but not respond)', async () => {
    const req = { params: { email: 'error@example.com' } };
    const res = mockRes();

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const mockExec = jest.fn().mockRejectedValue(new Error('DB failure'));
    const mockLean = jest.fn().mockReturnValue({ exec: mockExec });
    const mockFindOne = jest.fn().mockReturnValue({ lean: mockLean });

    UserProfile.findOne = mockFindOne;

    await isEmailExists(req, res);

    expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});