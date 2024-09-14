const { mockReq, mockRes, assertResMock } = require('../test');
const emailController = require('./emailController');
const jwt = require('jsonwebtoken');
// const EmailSubcriptionList = require('../models/emailSubcriptionList');
const userProfile = require('../models/userProfile');
// const emailSender = require('../utilities/emailSender');

jest.mock('jsonwebtoken');
jest.mock('../models/userProfile');
jest.mock('../models/emailSubcriptionList');
jest.mock('../utilities/emailSender');




const makeSut = () => {
  const {
    sendEmail,
    sendEmailToAll,
    updateEmailSubscriptions,
    addNonHgnEmailSubscription,
    removeNonHgnEmailSubscription,
    confirmNonHgnEmailSubscription,
  } = emailController;
  return {
    sendEmail,
    sendEmailToAll,
    updateEmailSubscriptions,
    addNonHgnEmailSubscription,
    removeNonHgnEmailSubscription,
    confirmNonHgnEmailSubscription,
  };
};
describe('emailController Controller Unit tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should send email successfully', async () => {
    const { sendEmail } = makeSut();
    const mockReq = {
      body: {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
      },
    };
    const response = await sendEmail(mockReq, mockRes);
    assertResMock(200, 'Email sent successfully', response, mockRes);
  });

  describe('updateEmailSubscriptions function', () => {
    test('should handle error when updating email subscriptions', async () => {
      const { updateEmailSubscriptions } = makeSut();


    userProfile.findOneAndUpdate = jest.fn();

      userProfile.findOneAndUpdate.mockRejectedValue(new Error('Update failed'));

      const mockReq = {
        body: {
          emailSubscriptions: ['subscription1', 'subscription2'],
          requestor: {
            email: 'test@example.com',
          },
        },
      };

      const response = await updateEmailSubscriptions(mockReq, mockRes);

      assertResMock(500, 'Error updating email subscriptions', response, mockRes);
    });
  });

  describe('addNonHgnEmailSubscription function', () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });
  })

  describe('confirmNonHgnEmailSubscription function', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    beforeAll(() => {
    jwt.verify = jest.fn();
    });

    test('should return 400 if token is not provided', async () => {
      const { confirmNonHgnEmailSubscription } = makeSut();

      const mockReq = { body: {} };
      const response = await confirmNonHgnEmailSubscription(mockReq, mockRes);

      assertResMock(400, 'Invalid token', response, mockRes);
    });

    test('should return 401 if token is invalid', async () => {
      const { confirmNonHgnEmailSubscription } = makeSut();
      const mockReq = { body: { token: 'invalidToken' } };

      jwt.verify.mockImplementation(() => {
        throw new Error('Token is not valid');
      });

      await confirmNonHgnEmailSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        errors: [
          { msg: 'Token is not valid' },
        ],
      });
    });


    test('should return 400 if email is missing from payload', async () => {
      const { confirmNonHgnEmailSubscription } = makeSut();
      const mockReq = { body: { token: 'validToken' } };

      // Mocking jwt.verify to return a payload without email
      jwt.verify.mockReturnValue({});

      const response = await confirmNonHgnEmailSubscription(mockReq, mockRes);

      assertResMock(400, 'Invalid token', response, mockRes);
    });





  });



});
