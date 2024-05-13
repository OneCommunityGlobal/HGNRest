jest.mock('uuid/v4');
jest.mock('../utilities/emailSender');

const uuidv4 = require('uuid/v4');
const emailSender = require('../utilities/emailSender');
const { mockReq, mockRes, assertResMock } = require('../test');
const forgotPwdController = require('./forgotPwdcontroller');
const UserProfile = require('../models/userProfile');
const escapeRegex = require('../utilities/escapeRegex');

uuidv4.mockImplementation(() => '');
emailSender.mockImplementation(() => undefined);

// Positive
// ✅ Return 200 if successfully generated temporary User password.

// Negative
// ✅ Return 500 if any error encountered while fetching User details.
// ✅ Return 500 if any error encountered while saving User's password.
// ✅ Return 400 if valid user not found.

function getEmailMessageForForgotPassword(user, ranPwd) {
  const message = `<b> Hello ${user.firstName} ${user.lastName},</b>
    <p>Congratulations on successfully completing the Highest Good Network 3-question Change My Password Challenge. Your reward is this NEW PASSWORD! </p>
    <blockquote> ${ranPwd}</blockquote>
    <p>Use it now to log in. Then store it in a safe place or change it on your Profile Page to something easier for you to remember. </p>
    <p>If it wasn’t you that requested this password change, you can ignore this email. Otherwise, use the password above to log in and you’ll be directed to the “Change Password” page where you can set a new custom one. </p>
    <p>Thank you,<p>
    <p>One Community</p>`;
  return message;
}

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

    test('Return 200 if a temporary password is generated for the user', async () => {
      const { forgotPwd } = makeSut();

      const mockUser = {
        // denote the User object obtained by find operation on MongoDB
        email: mockReq.body.email,
        firstName: mockReq.body.firstName,
        lastName: mockReq.body.lastName,
        set: jest.fn(), // Mocking the set method
        save: jest.fn().mockResolvedValueOnce(), // Mocking the save method
      };

      const message = { message: 'generated new password' };
      const findOneSpy = jest.spyOn(UserProfile, 'findOne').mockResolvedValueOnce(mockUser);

      const response = await forgotPwd(mockReq, mockRes);
      const temporaryPassword = uuidv4().concat('TEMP'); // The source code appends "TEMP" so does this line

      expect(mockUser.set).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      expect(emailSender).toHaveBeenCalledWith(
        mockUser.email,
        'Account Password change',
        getEmailMessageForForgotPassword(mockUser, temporaryPassword),
        null,
        null,
      );
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
  });
});
