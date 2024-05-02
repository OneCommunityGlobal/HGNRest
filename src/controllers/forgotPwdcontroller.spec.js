const { mockReq, mockRes, assertResMock } = require('../test');
const forgotPwdController = require('./forgotPwdcontroller');
const UserProfile = require('../models/userProfile');
const escapeRegex = require('../utilities/escapeRegex');

// ✅ Return 500 if any error encountered while fetching User details.
// ✅ Return 500 if any error encountered while saving User's password.
// ✅ Return 200 if successfully generated temporary User password.
// ✅ Return 400 if valid user not found.

// Mocking uuidv4

const makeSut = () => {
  const { forgotPwd } = forgotPwdController(UserProfile);
  return { forgotPwd };
};

describe('Unit Tests for forgotPwdcontroller.js', () => {
  beforeAll(() => {
    mockReq.body.email = 'parthgrads@gmail.com';
    mockReq.body.firstName = 'Parth';
    mockReq.body.lastName = 'Jangid';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Forgot Pwd Function', () => {
    test('Returns 500 if any error encountered while fetching user.', async () => {
      const { forgotPwd } = makeSut();

      const error = new Error('Database error');
      const findOneSpy = jest.spyOn(UserProfile, 'findOne').mockRejectedValueOnce(error);

      const response = await forgotPwd(mockReq, mockRes);

      assertResMock(500, error, response, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({
        // Check Parameters to findOne
        email: {
          $regex: escapeRegex(mockReq.body.email),
          $options: 'i',
        },
        firstName: {
          $regex: escapeRegex(mockReq.body.firstName),
          $options: 'i',
        },
        lastName: {
          $regex: escapeRegex(mockReq.body.lastName),
          $options: 'i',
        },
      });
    });

    test('Returns 400 if No Valid User found', async () => {
      const { forgotPwd } = makeSut();

      const userObject = null; // or undefined
      const error = { error: 'No Valid user was found' };

      const findOneSpy = jest.spyOn(UserProfile, 'findOne').mockResolvedValueOnce(userObject);

      const response = await forgotPwd(mockReq, mockRes);

      assertResMock(400, error, response, mockRes);

      expect(findOneSpy).toHaveBeenCalledWith({
        email: {
          $regex: escapeRegex(mockReq.body.email),
          $options: 'i',
        },
        firstName: {
          $regex: escapeRegex(mockReq.body.firstName),
          $options: 'i',
        },
        lastName: {
          $regex: escapeRegex(mockReq.body.lastName),
          $options: 'i',
        },
      });
    });

    test('Return 200 if a temporary password is generated for the user', async () => {
      const { forgotPwd } = makeSut();

      const mockUser = {
        set: jest.fn(), // Mocking the set method
        save: jest.fn().mockResolvedValueOnce(), // Mocking other methods as needed
      };

      const message = { message: 'generated new password' };
      const findOneSpy = jest.spyOn(UserProfile, 'findOne').mockResolvedValueOnce(mockUser);

      const response = await forgotPwd(mockReq, mockRes);

      expect(mockUser.set).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      assertResMock(200, message, response, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({
        email: {
          $regex: escapeRegex(mockReq.body.email),
          $options: 'i',
        },
        firstName: {
          $regex: escapeRegex(mockReq.body.firstName),
          $options: 'i',
        },
        lastName: {
          $regex: escapeRegex(mockReq.body.lastName),
          $options: 'i',
        },
      });
    });

    test('Return 500 if encountered any error while saving temporary password', async () => {
      const { forgotPwd } = makeSut();

      const error = { error: 'Error Saving User Details' }; // Error object to expect

      const mockUser = {
        set: jest.fn(), // Mocking the set method
        save: jest.fn().mockRejectedValueOnce(new Error(error)), // Mocked below using spyOn
      };

      const findOneSpy = jest.spyOn(UserProfile, 'findOne').mockResolvedValueOnce(mockUser);

      const response = await forgotPwd(mockReq, mockRes);

      expect(mockUser.set).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      assertResMock(500, error, response, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({
        email: {
          $regex: escapeRegex(mockReq.body.email),
          $options: 'i',
        },
        firstName: {
          $regex: escapeRegex(mockReq.body.firstName),
          $options: 'i',
        },
        lastName: {
          $regex: escapeRegex(mockReq.body.lastName),
          $options: 'i',
        },
      });
    });
  });
});
