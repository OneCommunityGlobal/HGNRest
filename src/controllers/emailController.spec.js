const jwt = require('jsonwebtoken');
// eslint-disable-next-line no-unused-vars
const { mockReq, mockRes, assertResMock } = require('../test');
const userProfile = require('../models/userProfile');
const emailController = require('./emailController');

jest.mock('jsonwebtoken');
jest.mock('../models/userProfile');
jest.mock('../utilities/emailSender');

const makeSut = () => {
  const {
    sendEmail,
    sendEmailToSubscribers,
    updateEmailSubscriptions,
    addNonHgnEmailSubscription,
    removeNonHgnEmailSubscription,
    confirmNonHgnEmailSubscription,
  } = emailController;
  return {
    sendEmail,
    sendEmailToSubscribers,
    updateEmailSubscriptions,
    addNonHgnEmailSubscription,
    removeNonHgnEmailSubscription,
    confirmNonHgnEmailSubscription,
  };
};

test.todo('TODO: Fix emailController Controller Unit tests');

describe('emailController Controller Unit tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmail function', () => {
    it.todo('TODO: Fix sendEmail function');
    // TODO: Fix this
    // test('should send email successfully', async () => {
    //   const { sendEmail } = makeSut();
    //   const mockReq = {
    //     body: {
    //       to: 'recipient@example.com',
    //       subject: 'Test Subject',
    //       html: '<p>Test Body</p>',
    //     },
    //   };
    //   const response = await sendEmail(mockReq, mockRes);
    //   assertResMock(200, 'Email sent successfully', response, mockRes);
    // });
  });
  // TODO: Fix this
  // test('should send email successfully', async () => {
  //   const { sendEmail } = makeSut();
  //   const mockReq = {
  //     body: {
  //       to: 'recipient@example.com',
  //       subject: 'Test Subject',
  //       html: '<p>Test Body</p>',
  //     },
  //   };
  //   const response = await sendEmail(mockReq, mockRes);
  //   assertResMock(200, 'Email sent successfully', response, mockRes);
  // });
});

describe('updateEmailSubscriptions function', () => {
  test('should handle error when updating email subscriptions', async () => {
    const { updateEmailSubscriptions } = makeSut();

    userProfile.findOneAndUpdate = jest.fn();

    userProfile.findOneAndUpdate.mockRejectedValue(new Error('Update failed'));

    const updateReq = {
      body: {
        emailSubscriptions: true,
        requestor: {
          email: 'test@example.com',
        },
      },
    };

    await updateEmailSubscriptions(updateReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Error updating email subscriptions',
    });
  });
});

describe('confirmNonHgnEmailSubscription function', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    jwt.verify = jest.fn();
  });

  test('should return 400 if token is not provided', async () => {
    const { confirmNonHgnEmailSubscription } = makeSut();

    const emptyReq = { body: {} };
    await confirmNonHgnEmailSubscription(emptyReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Token is required',
    });
  });

  test('should return 401 if token is invalid', async () => {
    const { confirmNonHgnEmailSubscription } = makeSut();
    const tokenReq = { body: { token: 'invalidToken' } };

    jwt.verify.mockImplementation(() => {
      throw new Error('Token is not valid');
    });

    await confirmNonHgnEmailSubscription(tokenReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid or expired token',
    });
  });

  test('should return 400 if email is missing from payload', async () => {
    const { confirmNonHgnEmailSubscription } = makeSut();
    const validTokenReq = { body: { token: 'validToken' } };

    // Mocking jwt.verify to return a payload without email
    jwt.verify.mockReturnValue({});

    await confirmNonHgnEmailSubscription(validTokenReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid token payload',
    });
  });
});

describe('removeNonHgnEmailSubscription function', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return 400 if email is missing', async () => {
    const { removeNonHgnEmailSubscription } = makeSut();
    const noEmailReq = { body: {} };

    await removeNonHgnEmailSubscription(noEmailReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Email is required',
    });
  });
});
