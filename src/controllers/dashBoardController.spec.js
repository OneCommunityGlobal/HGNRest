jest.mock('uuid/v4');
jest.mock('../utilities/emailSender', () => jest.fn());

const uuidv4 = require('uuid/v4');
const emailSender = require('../utilities/emailSender');
const { mockReq, mockRes, assertResMock } = require('../test');
const forgotPwdController = require('./forgotPwdcontroller');
const UserProfile = require('../models/userProfile');
const escapeRegex = require('../utilities/escapeRegex');

jest.mock('../utilities/emailSender', () => jest.fn());
// const emailSender = require('../utilities/emailSender');
jest.mock('../utilities/emailSender', () => ({
  sendEmail: jest.fn(),
}));
const { sendEmail } = require('../utilities/emailSender');

uuidv4.mockReturnValue('');
emailSender.mockImplementation(() => Promise.resolve());

// const flushPromises = () => new Promise(setImmediate);


function getEmailMessageForForgotPassword(user, ranPwd) {
  return `<b> Hello ${user.firstName} ${user.lastName},</b>
    <p>Congratulations on successfully completing the Highest Good Network 3-question Change My Password Challenge. Your reward is this NEW PASSWORD! </p>
    <blockquote> ${ranPwd}</blockquote>
    <p>Use it now to log in. Then store it in a safe place or change it on your Profile Page to something easier for you to remember. </p>
    <p>If it wasn’t you that requested this password change, you can ignore this email. Otherwise, use the password above to log in and you’ll be directed to the “Change Password” page where you can set a new custom one. </p>
    <p>Thank you,<p>
    <p>One Community</p>`;
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
    test('Return 500 if encountered any error while fetching User details', async () => {
      const { forgotPwd } = makeSut();

      const error = new Error('DB fetch failed');
      const findOneSpy = jest.spyOn(UserProfile, 'findOne').mockRejectedValueOnce(error);

      const response = await forgotPwd(mockReq, mockRes);

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
        _id: 'mock-user-id',
      };

      const findOneSpy = jest.spyOn(UserProfile, 'findOne').mockResolvedValueOnce(mockUser);

      uuidv4.mockReturnValue('mocked-uuid');

      const response = await forgotPwd(mockReq, mockRes);

      const temporaryPassword = 'mocked-uuidTEMP';
      const expectedEmailMessage = getEmailMessageForForgotPassword(mockUser, temporaryPassword);

      expect(mockUser.set).toHaveBeenCalledWith({ resetPwd: temporaryPassword });
      expect(mockUser.save).toHaveBeenCalled();
      expect(emailSender).toHaveBeenCalledWith(
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


      const mockRequest = {
        ...mockReq,
        body: {
          firstName: 'Lin',
          lastName: 'Test',
          title: 'Bug in feature X',
          environment: 'macOS 10.15, Chrome 89, App version 1.2.3',
          reproduction: '1. Click on button A\n2. Enter valid data\n3. Click submit',
          expected: 'The app should not display an error message',
          actual: 'The app crashes',
          visual: 'Screenshot attached',
          severity: 'High',
          email: 'lin.test@example.com',
        },
      };

      const { sendBugReport } = makeSut();

      await sendBugReport(mockRequest, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith('Failed to send email');
    });
  });

  describe('sendMakeSuggestion Tests', () => {
    test('Returns 500 if the suggestion email fails to send', async () => {
      emailSender.mockImplementation(() => {
        throw new Error('Failed to send email');
      });

      const mockRequest = {
        ...mockReq,
        body: {
          suggestioncate: 'Identify and remedy poor client and/or user service experiences',
          suggestion: 'This is a sample suggestion',
          confirm: 'true',
          email: 'test@example.com',
          firstName: 'Lin',
          lastName: 'Test',
          field: ['field1', 'field2'],
        },
      };

      const { sendMakeSuggestion } = makeSut();

      await sendMakeSuggestion(mockRequest, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith('Failed to send email');
    });

    test('Returns 200 if the suggestion email is sent successfully', async () => {
      emailSender.mockResolvedValueOnce('Success');

      const mockRequest = {
        ...mockReq,
        body: {
          suggestioncate: 'Identify and remedy poor client and/or user service experiences',
          suggestion: 'This is a sample suggestion',
          confirm: 'true',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          field: ['field1', 'field2'],
        },
      };

      const { sendBugReport } = makeSut();

      await sendMakeSuggestion(mockRequest, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('Success');
    });
  });

  // Need to make test cases for negative case
  describe('getSuggestionOption Tests', () => {
    // test.only('Returns 404 if the suggestion data is not found', async () => {

    //   const { getSuggestionOption } = makeSut();

    //   await getSuggestionOption(mockReq, mockRes);

    //   await flushPromises();

    //   expect(mockRes.status).toHaveBeenCalledWith(404);
    //   expect(mockRes.send).toHaveBeenCalledWith('Suggestion Data Not Found');
    // });

    test('Returns 200 if there is suggestion data', async () => {
      const suggestionData = {
        field: [],
        suggestion: [
          'Identify and remedy poor client and/or user service experiences',
          'Identify bright spots and enhance positive service experiences',
          'Make fundamental changes to our programs and/or operations',
          'Inform the development of new programs/projects',
          'Identify where we are less inclusive or equitable across demographic groups',
          'Strengthen relationships with the people we serve',
          "Understand people's needs and how we can help them achieve their goals",
          'Other',
        ],
      };

      const { getSuggestionOption } = makeSut();

      await getSuggestionOption(mockReq, mockRes);

      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(suggestionData);
    });
  });

  // Need to make test cases for negative case
  describe('editSuggestionOption tests', () => {
    test('Returns 200 if suggestionData.field is added a new field', async () => {
      const suggestionData = {
        suggestion: ['newSuggestion'],
        field: ['newField'],
      };

      mockReq.body = {
        suggestion: true,
        action: 'add',
        newField: 'new field',
      };

      const { editSuggestionOption } = makeSut();

      await editSuggestionOption(mockReq, mockRes);

      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(suggestionData.field).toEqual(['newField']);
      expect(mockRes.send).toHaveBeenCalledWith('success');
    });

    test('Returns 200 if suggestionData.suggestion is added a new suggestion', async () => {
      const suggestionData = {
        suggestion: ['newSuggestion'],
        field: [],
      };

      mockReq.body = {
        suggestion: true,
        action: 'add',
        newField: 'new suggestion',
      };

      const { editSuggestionOption } = makeSut();

      await editSuggestionOption(mockReq, mockRes);

      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(suggestionData.suggestion).toEqual(['newSuggestion']);
      expect(mockRes.send).toHaveBeenCalledWith('success');
    });

    test('Returns 200 if suggestionData.field is deleted', async () => {
      const suggestionData = {
        suggestion: ['newSuggestion'],
        field: [],
      };

      mockReq.body = {
        suggestion: true,
        action: 'delete',
        newField: 'new field',
      };

      const { editSuggestionOption } = makeSut();

      await editSuggestionOption(mockReq, mockRes);

      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(suggestionData.field).toEqual([]);
      expect(mockRes.send).toHaveBeenCalledWith('success');
    });
  });
});
