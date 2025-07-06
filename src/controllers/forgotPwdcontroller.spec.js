jest.mock('uuid/v4');
jest.mock('../utilities/emailSender', () => jest.fn());

const uuidv4 = require('uuid/v4');
const emailSender = require('../utilities/emailSender');
const { mockReq, mockRes, assertResMock } = require('../test');
const forgotPwdController = require('./forgotPwdcontroller');
const UserProfile = require('../models/userProfile');
const escapeRegex = require('../utilities/escapeRegex');

uuidv4.mockReturnValue('');
emailSender.mockImplementation(() => Promise.resolve());

const flushPromises = () => new Promise(setImmediate);

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
  beforeEach(() => {
    jest.clearAllMocks();
    mockReq.body.email = 'parthgrads@gmail.com';
    mockReq.body.firstName = 'Parth';
    mockReq.body.lastName = 'Jangid';
  });

  describe('Forgot Pwd Function', () => {
    test('Return 500 if encountered any error while saving temporary password', async () => {
      const { forgotPwd } = makeSut();

      const error = new Error('Error Saving User Details');
      const mockUser = {
        set: jest.fn(),
        save: jest.fn().mockRejectedValueOnce(error),
      };

      const findOneSpy = jest.spyOn(UserProfile, 'findOne').mockResolvedValueOnce(mockUser);

      const response = await forgotPwd(mockReq, mockRes);

      expect(mockUser.set).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      assertResMock(500, error, response, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({
        email: { $regex: escapeRegex(mockReq.body.email), $options: 'i' },
        firstName: { $regex: escapeRegex(mockReq.body.firstName), $options: 'i' },
        lastName: { $regex: escapeRegex(mockReq.body.lastName), $options: 'i' },
      });
    });

    test('Returns 400 if No Valid User found', async () => {
      const { forgotPwd } = makeSut();

      const findOneSpy = jest.spyOn(UserProfile, 'findOne').mockResolvedValueOnce(null);

      const response = await forgotPwd(mockReq, mockRes);

      assertResMock(400, { error: 'No Valid user was found' }, response, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({
        email: { $regex: escapeRegex(mockReq.body.email), $options: 'i' },
        firstName: { $regex: escapeRegex(mockReq.body.firstName), $options: 'i' },
        lastName: { $regex: escapeRegex(mockReq.body.lastName), $options: 'i' },
      });
    });

    test('Return 500 if encountered any error while saving temporary password', async () => {
      const { forgotPwd } = makeSut();

      const error = new Error('Error Saving User Details');
      const mockUser = {
        set: jest.fn(),
        save: jest.fn().mockRejectedValueOnce(error),
      };

      const findOneSpy = jest.spyOn(UserProfile, 'findOne').mockResolvedValueOnce(mockUser);

      const response = await forgotPwd(mockReq, mockRes);

      expect(mockUser.set).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      assertResMock(500, error, response, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({
        email: { $regex: escapeRegex(mockReq.body.email), $options: 'i' },
        firstName: { $regex: escapeRegex(mockReq.body.firstName), $options: 'i' },
        lastName: { $regex: escapeRegex(mockReq.body.lastName), $options: 'i' },
      });
    });

    test('Return 200 if a temporary password is generated for the user', async () => {
      const { forgotPwd } = makeSut();

      const mockUser = {
        email: mockReq.body.email,
        firstName: mockReq.body.firstName,
        lastName: mockReq.body.lastName,
        set: jest.fn(),
        save: jest.fn().mockResolvedValueOnce(),
      };

      const findOneSpy = jest.spyOn(UserProfile, 'findOne').mockResolvedValueOnce(mockUser);

      uuidv4.mockReturnValue('mocked-uuid');

      const response = await forgotPwd(mockReq, mockRes);

      const temporaryPassword = 'mocked-uuidTEMP';
      const expectedEmailMessage = getEmailMessageForForgotPassword(mockUser, temporaryPassword);

      expect(mockUser.set).toHaveBeenCalledWith({ resetPwd: temporaryPassword });
      expect(mockUser.save).toHaveBeenCalled();
      expect(emailSender.sendEmail).toHaveBeenCalledWith(
        mockUser.email,
        'Account Password change',
        expectedEmailMessage,
        null,
        null,
      );
      assertResMock(200, { message: 'generated new password' }, response, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({
        email: { $regex: escapeRegex(mockReq.body.email), $options: 'i' },
        firstName: { $regex: escapeRegex(mockReq.body.firstName), $options: 'i' },
        lastName: { $regex: escapeRegex(mockReq.body.lastName), $options: 'i' },
      });
    });
  });
});
