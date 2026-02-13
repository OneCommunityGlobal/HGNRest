jest.mock('jsonwebtoken');
jest.mock('../utilities/emailSender');
jest.mock('../models/userProfile');
jest.mock('../models/emailSubcriptionList');
jest.mock('../utilities/permissions');
jest.mock('../utilities/transactionHelper');
jest.mock('../services/announcements/emails/emailTemplateService');
jest.mock('../services/announcements/emails/emailBatchService');
jest.mock('../services/announcements/emails/emailService');
jest.mock('../services/announcements/emails/emailProcessor', () => ({
  queueEmail: jest.fn(),
  processPendingAndStuckEmails: jest.fn(),
}));
jest.mock('../utilities/emailValidators', () => ({
  isValidEmailAddress: jest.fn(() => true),
  normalizeRecipientsToArray: jest.fn((to) => (Array.isArray(to) ? to : [to])),
}));

const jwt = require('jsonwebtoken');
const emailSender = require('../utilities/emailSender');
const userProfile = require('../models/userProfile');
const EmailSubcriptionList = require('../models/emailSubcriptionList');
const { hasPermission } = require('../utilities/permissions');
const { withTransaction } = require('../utilities/transactionHelper');
const EmailTemplateService = require('../services/announcements/emails/emailTemplateService');
const EmailBatchService = require('../services/announcements/emails/emailBatchService');
const EmailService = require('../services/announcements/emails/emailService');
const emailProcessor = require('../services/announcements/emails/emailProcessor');
const { isValidEmailAddress } = require('../utilities/emailValidators');
const emailController = require('./emailController');

const {
  sendEmail,
  sendEmailToSubscribers,
  resendEmail,
  retryEmail,
  processPendingAndStuckEmails,
  updateEmailSubscriptions,
  addNonHgnEmailSubscription,
  confirmNonHgnEmailSubscription,
  removeNonHgnEmailSubscription,
} = emailController;

describe('emailController', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: {
        requestor: { requestorId: 'user-1', email: 'test@example.com' },
      },
      params: {},
      query: {},
      get: jest.fn(),
      protocol: 'https',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    process.env.JWT_SECRET = 'test-secret';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    jest.restoreAllMocks();
  });

  // ── sendEmail ───────────────────────────────────────────────────────
  describe('sendEmail', () => {
    it('should return 401 when no requestor', async () => {
      req.body.requestor = undefined;
      await sendEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when no permission', async () => {
      hasPermission.mockResolvedValue(false);
      await sendEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 when subject is missing', async () => {
      hasPermission.mockResolvedValue(true);
      req.body.subject = '';
      req.body.html = '<p>Hi</p>';
      await sendEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when html is missing', async () => {
      hasPermission.mockResolvedValue(true);
      req.body.subject = 'Test';
      req.body.html = '';
      await sendEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when template variables are unmatched', async () => {
      hasPermission.mockResolvedValue(true);
      req.body.subject = 'Hello';
      req.body.html = '<p>Hi {{name}}</p>';
      req.body.to = ['a@b.com'];
      EmailTemplateService.getUnreplacedVariables
        .mockReturnValueOnce(['name'])
        .mockReturnValueOnce([]);
      await sendEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 200 on success', async () => {
      hasPermission.mockResolvedValue(true);
      req.body.subject = 'Test';
      req.body.html = '<p>Hi</p>';
      req.body.to = ['a@b.com'];
      EmailTemplateService.getUnreplacedVariables.mockReturnValue([]);
      userProfile.findById.mockResolvedValue({ _id: 'user-1' });
      withTransaction.mockImplementation(async (fn) => fn('session'));
      EmailService.createEmail.mockResolvedValue({ _id: 'email-1' });
      EmailBatchService.createEmailBatches.mockResolvedValue();
      emailProcessor.queueEmail.mockReturnValue(true);

      await sendEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 503 when queue is full', async () => {
      hasPermission.mockResolvedValue(true);
      req.body.subject = 'Test';
      req.body.html = '<p>Hi</p>';
      req.body.to = ['a@b.com'];
      EmailTemplateService.getUnreplacedVariables.mockReturnValue([]);
      userProfile.findById.mockResolvedValue({ _id: 'user-1' });
      EmailService.createEmail.mockResolvedValue({ _id: 'email-1' });
      EmailBatchService.createEmailBatches.mockResolvedValue();
      emailProcessor.queueEmail.mockReturnValue(false);
      withTransaction.mockImplementation(async (fn) => fn('session'));

      await sendEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  // ── sendEmailToSubscribers ──────────────────────────────────────────
  describe('sendEmailToSubscribers', () => {
    it('should return 401 when no requestor', async () => {
      req.body.requestor = undefined;
      await sendEmailToSubscribers(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when no permission', async () => {
      hasPermission.mockResolvedValue(false);
      await sendEmailToSubscribers(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 200 on success', async () => {
      hasPermission.mockResolvedValue(true);
      req.body.subject = 'Newsletter';
      req.body.html = '<p>News</p>';
      EmailTemplateService.getUnreplacedVariables.mockReturnValue([]);
      userProfile.findById.mockResolvedValue({ _id: 'user-1' });
      userProfile.find.mockResolvedValue([{ email: 'a@b.com' }]);
      EmailSubcriptionList.find.mockResolvedValue([{ email: 'c@d.com' }]);
      withTransaction.mockImplementation(async (fn) => fn('session'));
      EmailService.createEmail.mockResolvedValue({ _id: 'email-1' });
      EmailBatchService.createEmailBatches.mockResolvedValue();
      emailProcessor.queueEmail.mockReturnValue(true);

      await sendEmailToSubscribers(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 when no recipients found', async () => {
      hasPermission.mockResolvedValue(true);
      req.body.subject = 'Newsletter';
      req.body.html = '<p>News</p>';
      EmailTemplateService.getUnreplacedVariables.mockReturnValue([]);
      userProfile.findById.mockResolvedValue({ _id: 'user-1' });
      userProfile.find.mockResolvedValue([]);
      EmailSubcriptionList.find.mockResolvedValue([]);

      await sendEmailToSubscribers(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── resendEmail ─────────────────────────────────────────────────────
  describe('resendEmail', () => {
    it('should return 401 when no requestor', async () => {
      req.body.requestor = undefined;
      await resendEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when no permission', async () => {
      hasPermission.mockResolvedValue(false);
      await resendEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 for invalid emailId', async () => {
      hasPermission.mockResolvedValue(true);
      req.body.emailId = 'bad';
      await resendEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing recipientOption', async () => {
      hasPermission.mockResolvedValue(true);
      req.body.emailId = '507f1f77bcf86cd799439011';
      EmailService.getEmailById.mockResolvedValue({ subject: 'Test', htmlContent: '<p>Hi</p>' });
      await resendEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── retryEmail ──────────────────────────────────────────────────────
  describe('retryEmail', () => {
    it('should return 401 when no requestor', async () => {
      req.body.requestor = undefined;
      req.params.emailId = '507f1f77bcf86cd799439011';
      await retryEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 for invalid emailId', async () => {
      req.params.emailId = 'bad';
      await retryEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 403 when no permission', async () => {
      hasPermission.mockResolvedValue(false);
      req.params.emailId = '507f1f77bcf86cd799439011';
      await retryEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 when email is not in retryable status', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.emailId = '507f1f77bcf86cd799439011';
      EmailService.getEmailById.mockResolvedValue({ _id: req.params.emailId, status: 'SENDING' });
      await retryEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 200 with 0 items when no failed batches', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.emailId = '507f1f77bcf86cd799439011';
      EmailService.getEmailById.mockResolvedValue({ _id: req.params.emailId, status: 'FAILED' });
      EmailBatchService.getFailedBatchesForEmail.mockResolvedValue([]);
      await retryEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ failedItemsRetried: 0 }) }),
      );
    });

    it('should return 200 on successful retry', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.emailId = '507f1f77bcf86cd799439011';
      EmailService.getEmailById.mockResolvedValue({ _id: req.params.emailId, status: 'FAILED' });
      EmailBatchService.getFailedBatchesForEmail.mockResolvedValue([{ _id: 'b1' }, { _id: 'b2' }]);
      EmailService.markEmailPending.mockResolvedValue();
      EmailBatchService.resetEmailBatchForRetry.mockResolvedValue();
      emailProcessor.queueEmail.mockReturnValue(true);

      await retryEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ failedItemsRetried: 2 }) }),
      );
    });

    it('should return 503 when queue is full', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.emailId = '507f1f77bcf86cd799439011';
      EmailService.getEmailById.mockResolvedValue({ _id: req.params.emailId, status: 'FAILED' });
      EmailBatchService.getFailedBatchesForEmail.mockResolvedValue([{ _id: 'b1' }]);
      EmailService.markEmailPending.mockResolvedValue();
      EmailBatchService.resetEmailBatchForRetry.mockResolvedValue();
      emailProcessor.queueEmail.mockReturnValue(false);

      await retryEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  // ── processPendingAndStuckEmails ────────────────────────────────────
  describe('processPendingAndStuckEmails', () => {
    it('should return 401 when no requestor', async () => {
      req.body.requestor = undefined;
      await processPendingAndStuckEmails(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when no permission', async () => {
      hasPermission.mockResolvedValue(false);
      await processPendingAndStuckEmails(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 200 with stats', async () => {
      hasPermission.mockResolvedValue(true);
      emailProcessor.processPendingAndStuckEmails.mockResolvedValue({
        stuckEmailsReset: 1,
        stuckBatchesReset: 2,
        runtimeStuckBatchesReset: 0,
        pendingEmailsQueued: 3,
      });
      await processPendingAndStuckEmails(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Recovery complete'),
        }),
      );
    });

    it('should return "all clear" when no work done', async () => {
      hasPermission.mockResolvedValue(true);
      emailProcessor.processPendingAndStuckEmails.mockResolvedValue({
        stuckEmailsReset: 0,
        stuckBatchesReset: 0,
        runtimeStuckBatchesReset: 0,
        pendingEmailsQueued: 0,
      });
      await processPendingAndStuckEmails(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('all clear'),
        }),
      );
    });
  });

  // ── updateEmailSubscriptions ────────────────────────────────────────
  describe('updateEmailSubscriptions', () => {
    it('should return 401 when no requestor email', async () => {
      req.body.requestor = {};
      await updateEmailSubscriptions(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when emailSubscriptions is not boolean', async () => {
      req.body.emailSubscriptions = 'yes';
      await updateEmailSubscriptions(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when email is invalid', async () => {
      req.body.emailSubscriptions = true;
      isValidEmailAddress.mockReturnValue(false);
      await updateEmailSubscriptions(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when user not found', async () => {
      req.body.emailSubscriptions = true;
      isValidEmailAddress.mockReturnValue(true);
      userProfile.findOneAndUpdate.mockResolvedValue(null);
      await updateEmailSubscriptions(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 on success', async () => {
      req.body.emailSubscriptions = true;
      isValidEmailAddress.mockReturnValue(true);
      userProfile.findOneAndUpdate.mockResolvedValue({ email: 'test@example.com' });
      await updateEmailSubscriptions(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 on error', async () => {
      req.body.emailSubscriptions = true;
      isValidEmailAddress.mockReturnValue(true);
      userProfile.findOneAndUpdate.mockRejectedValue(new Error('Update failed'));
      await updateEmailSubscriptions(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ── addNonHgnEmailSubscription ──────────────────────────────────────
  describe('addNonHgnEmailSubscription', () => {
    it('should return 400 when email is missing', async () => {
      req.body = {};
      await addNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when email is invalid', async () => {
      req.body.email = 'bad-email';
      isValidEmailAddress.mockReturnValue(false);
      await addNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when already subscribed', async () => {
      req.body.email = 'test@example.com';
      isValidEmailAddress.mockReturnValue(true);
      EmailSubcriptionList.findOne.mockResolvedValue({ email: 'test@example.com' });
      await addNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when email belongs to HGN user', async () => {
      req.body.email = 'test@example.com';
      isValidEmailAddress.mockReturnValue(true);
      EmailSubcriptionList.findOne.mockResolvedValue(null);
      userProfile.findOne.mockResolvedValue({ email: 'test@example.com' });
      await addNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 200 on success', async () => {
      req.body.email = 'new@example.com';
      isValidEmailAddress.mockReturnValue(true);
      EmailSubcriptionList.findOne.mockResolvedValue(null);
      userProfile.findOne.mockResolvedValue(null);
      EmailSubcriptionList.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue({}),
      }));
      jwt.sign.mockReturnValue('mock-token');
      req.get.mockReturnValue('https://example.com');
      emailSender.mockResolvedValue();

      await addNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should still return 200 when confirmation email fails', async () => {
      req.body.email = 'new@example.com';
      isValidEmailAddress.mockReturnValue(true);
      EmailSubcriptionList.findOne.mockResolvedValue(null);
      userProfile.findOne.mockResolvedValue(null);
      EmailSubcriptionList.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue({}),
      }));
      jwt.sign.mockReturnValue('mock-token');
      req.get.mockReturnValue('https://example.com');
      emailSender.mockRejectedValue(new Error('SMTP error'));

      await addNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── confirmNonHgnEmailSubscription ──────────────────────────────────
  describe('confirmNonHgnEmailSubscription', () => {
    it('should return 400 when token is missing', async () => {
      req.body = {};
      await confirmNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 when token is invalid', async () => {
      req.body.token = 'bad-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Token is not valid');
      });
      await confirmNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when email is missing from payload', async () => {
      req.body.token = 'valid-token';
      jwt.verify.mockReturnValue({});
      isValidEmailAddress.mockReturnValue(false);
      await confirmNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when subscription not found', async () => {
      req.body.token = 'valid-token';
      jwt.verify.mockReturnValue({ email: 'test@example.com' });
      isValidEmailAddress.mockReturnValue(true);
      EmailSubcriptionList.findOne.mockResolvedValue(null);
      await confirmNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 if already confirmed', async () => {
      req.body.token = 'valid-token';
      jwt.verify.mockReturnValue({ email: 'test@example.com' });
      isValidEmailAddress.mockReturnValue(true);
      EmailSubcriptionList.findOne.mockResolvedValue({ isConfirmed: true });
      await confirmNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should confirm and return 200', async () => {
      req.body.token = 'valid-token';
      jwt.verify.mockReturnValue({ email: 'test@example.com' });
      isValidEmailAddress.mockReturnValue(true);
      const subscription = {
        isConfirmed: false,
        save: jest.fn().mockResolvedValue({}),
      };
      EmailSubcriptionList.findOne.mockResolvedValue(subscription);
      await confirmNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(subscription.isConfirmed).toBe(true);
      expect(subscription.save).toHaveBeenCalled();
    });
  });

  // ── removeNonHgnEmailSubscription ───────────────────────────────────
  describe('removeNonHgnEmailSubscription', () => {
    it('should return 400 when email is missing', async () => {
      req.body = {};
      await removeNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when email is invalid', async () => {
      req.body.email = 'bad';
      isValidEmailAddress.mockReturnValue(false);
      await removeNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when subscription not found', async () => {
      req.body.email = 'test@example.com';
      isValidEmailAddress.mockReturnValue(true);
      EmailSubcriptionList.findOneAndDelete.mockResolvedValue(null);
      await removeNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 on success', async () => {
      req.body.email = 'test@example.com';
      isValidEmailAddress.mockReturnValue(true);
      EmailSubcriptionList.findOneAndDelete.mockResolvedValue({ email: 'test@example.com' });
      await removeNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 on error', async () => {
      req.body.email = 'test@example.com';
      isValidEmailAddress.mockReturnValue(true);
      EmailSubcriptionList.findOneAndDelete.mockRejectedValue(new Error('DB error'));
      await removeNonHgnEmailSubscription(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
