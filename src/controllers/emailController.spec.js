const { mockReq, mockRes, assertResMock } = require('../test');
const emailController = require('./emailController');

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
        html: '<p>Test Body</p>'
      }
    };
    const response = await sendEmail(mockReq, mockRes);
    assertResMock(200, 'Email sent successfully', response, mockRes);
  });
});
