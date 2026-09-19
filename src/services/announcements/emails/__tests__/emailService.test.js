/* eslint-disable global-require */

// Must use factory mock for emailValidators because emailService.js destructures
// the function at require time, making jest.spyOn ineffective.
jest.mock('../../../../utilities/emailValidators', () => ({
  ensureHtmlWithinLimit: jest.fn().mockReturnValue(true),
  isValidEmailAddress: jest.fn().mockReturnValue(true),
  normalizeRecipientsToArray: jest.fn((r) => r),
  normalizeRecipientsToObjects: jest.fn((r) => r),
  normalizeEmailField: jest.fn((f) => f),
}));

// Auto-mock models (keeps prototype chain intact so jest.spyOn on prototype works)
jest.mock('../../../../models/email');
jest.mock('../../../../models/emailBatch');

const mongoose = require('mongoose');
const EmailService = require('../emailService');
const Email = require('../../../../models/email');
const EmailBatch = require('../../../../models/emailBatch');
const { EMAIL_CONFIG } = require('../../../../config/emailConfig');
const { ensureHtmlWithinLimit } = require('../../../../utilities/emailValidators');

describe('EmailService', () => {
  beforeEach(() => {
    // Manually mock mongoose model statics
    Email.findById = jest.fn();
    Email.findByIdAndUpdate = jest.fn();
    Email.findOneAndUpdate = jest.fn();
    Email.find = jest.fn();

    EmailBatch.aggregate = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // ── createEmail ──────────────────────────────────────────────────────
  describe('createEmail', () => {
    const validCreatedBy = new mongoose.Types.ObjectId();

    it('should throw 400 when subject is empty', async () => {
      await expect(
        EmailService.createEmail({
          subject: '',
          htmlContent: '<p>Hi</p>',
          createdBy: validCreatedBy,
        }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'Subject is required' });
    });

    it('should throw 400 when subject is not a string', async () => {
      await expect(
        EmailService.createEmail({
          subject: 123,
          htmlContent: '<p>Hi</p>',
          createdBy: validCreatedBy,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 when htmlContent is empty', async () => {
      await expect(
        EmailService.createEmail({ subject: 'Test', htmlContent: '', createdBy: validCreatedBy }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'HTML content is required' });
    });

    it('should throw 400 when createdBy is invalid ObjectId', async () => {
      await expect(
        EmailService.createEmail({
          subject: 'Test',
          htmlContent: '<p>Hi</p>',
          createdBy: 'bad-id',
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 when subject exceeds max length', async () => {
      const longSubject = 'x'.repeat(EMAIL_CONFIG.LIMITS.SUBJECT_MAX_LENGTH + 1);
      await expect(
        EmailService.createEmail({
          subject: longSubject,
          htmlContent: '<p>Hi</p>',
          createdBy: validCreatedBy,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 413 when HTML content exceeds limit', async () => {
      ensureHtmlWithinLimit.mockReturnValue(false);
      await expect(
        EmailService.createEmail({
          subject: 'Test',
          htmlContent: '<p>big</p>',
          createdBy: validCreatedBy,
        }),
      ).rejects.toMatchObject({ statusCode: 413 });
      ensureHtmlWithinLimit.mockReturnValue(true); // reset
    });

    it('should create and return email on success', async () => {
      jest.spyOn(Email.prototype, 'save').mockResolvedValue(undefined);

      const result = await EmailService.createEmail({
        subject: '  Hello  ',
        htmlContent: '  <p>World</p>  ',
        createdBy: validCreatedBy,
      });

      expect(Email.prototype.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should pass session to save when provided', async () => {
      const mockSession = { id: 'session-1' };
      jest.spyOn(Email.prototype, 'save').mockResolvedValue(undefined);

      await EmailService.createEmail(
        { subject: 'Test', htmlContent: '<p>Hi</p>', createdBy: validCreatedBy },
        mockSession,
      );

      expect(Email.prototype.save).toHaveBeenCalledWith({ session: mockSession });
    });

    it('should throw 400 on ValidationError during save', async () => {
      const dbError = new Error('Validation failed');
      dbError.name = 'ValidationError';
      jest.spyOn(Email.prototype, 'save').mockRejectedValue(dbError);

      await expect(
        EmailService.createEmail({
          subject: 'Test',
          htmlContent: '<p>Hi</p>',
          createdBy: validCreatedBy,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 409 on duplicate key error during save', async () => {
      const dbError = new Error('dup key');
      dbError.code = 11000;
      jest.spyOn(Email.prototype, 'save').mockRejectedValue(dbError);

      await expect(
        EmailService.createEmail({
          subject: 'Test',
          htmlContent: '<p>Hi</p>',
          createdBy: validCreatedBy,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should throw 500 on other database errors', async () => {
      const dbError = new Error('DB connection lost');
      jest.spyOn(Email.prototype, 'save').mockRejectedValue(dbError);

      await expect(
        EmailService.createEmail({
          subject: 'Test',
          htmlContent: '<p>Hi</p>',
          createdBy: validCreatedBy,
        }),
      ).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  // ── getEmailById ─────────────────────────────────────────────────────
  describe('getEmailById', () => {
    it('should return null for invalid ID when throwIfNotFound is false', async () => {
      const result = await EmailService.getEmailById('bad-id');
      expect(result).toBeNull();
    });

    it('should throw 400 for invalid ID when throwIfNotFound is true', async () => {
      await expect(EmailService.getEmailById('bad-id', null, true)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should return null when email not found and throwIfNotFound is false', async () => {
      const mockQuery = {
        session: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };
      Email.findById.mockReturnValue(mockQuery);
      mockQuery.then = (resolve) => resolve(null);

      const result = await EmailService.getEmailById(new mongoose.Types.ObjectId());
      expect(result).toBeNull();
    });

    it('should throw 404 when email not found and throwIfNotFound is true', async () => {
      const mockQuery = {
        session: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };
      Email.findById.mockReturnValue(mockQuery);
      mockQuery.then = (resolve) => resolve(null);

      await expect(
        EmailService.getEmailById(new mongoose.Types.ObjectId(), null, true),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should return email when found', async () => {
      const emailDoc = { _id: new mongoose.Types.ObjectId(), subject: 'Test' };
      const mockQuery = {
        session: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };
      Email.findById.mockReturnValue(mockQuery);
      mockQuery.then = (resolve) => resolve(emailDoc);

      const result = await EmailService.getEmailById(emailDoc._id);
      expect(result).toEqual(emailDoc);
    });

    it('should use session when provided', async () => {
      const session = { id: 'sess' };
      const emailDoc = { _id: new mongoose.Types.ObjectId() };
      const mockQuery = {
        session: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };
      Email.findById.mockReturnValue(mockQuery);
      mockQuery.then = (resolve) => resolve(emailDoc);

      await EmailService.getEmailById(emailDoc._id, session);
      expect(mockQuery.session).toHaveBeenCalledWith(session);
    });

    it('should populate createdBy when option is true', async () => {
      const emailDoc = { _id: new mongoose.Types.ObjectId() };
      const mockQuery = {
        session: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };
      Email.findById.mockReturnValue(mockQuery);
      mockQuery.then = (resolve) => resolve(emailDoc);

      await EmailService.getEmailById(emailDoc._id, null, false, true);
      expect(mockQuery.populate).toHaveBeenCalledWith('createdBy', 'firstName lastName email');
    });
  });

  // ── updateEmailStatus ────────────────────────────────────────────────
  describe('updateEmailStatus', () => {
    it('should throw 400 for invalid email ID', async () => {
      await expect(
        EmailService.updateEmailStatus('bad', EMAIL_CONFIG.EMAIL_STATUSES.SENT),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 for invalid status', async () => {
      await expect(
        EmailService.updateEmailStatus(new mongoose.Types.ObjectId(), 'INVALID_STATUS'),
      ).rejects.toMatchObject({ statusCode: 400, message: 'Invalid email status' });
    });

    it('should throw 404 when email not found', async () => {
      Email.findByIdAndUpdate.mockResolvedValue(null);
      await expect(
        EmailService.updateEmailStatus(
          new mongoose.Types.ObjectId(),
          EMAIL_CONFIG.EMAIL_STATUSES.SENT,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should update and return email on success', async () => {
      const emailDoc = {
        _id: new mongoose.Types.ObjectId(),
        status: EMAIL_CONFIG.EMAIL_STATUSES.SENT,
      };
      Email.findByIdAndUpdate.mockResolvedValue(emailDoc);

      const result = await EmailService.updateEmailStatus(
        emailDoc._id,
        EMAIL_CONFIG.EMAIL_STATUSES.SENT,
      );
      expect(result).toEqual(emailDoc);
      expect(Email.findByIdAndUpdate).toHaveBeenCalledWith(
        emailDoc._id,
        expect.objectContaining({ status: EMAIL_CONFIG.EMAIL_STATUSES.SENT }),
        { new: true },
      );
    });
  });

  // ── markEmailStarted ────────────────────────────────────────────────
  describe('markEmailStarted', () => {
    it('should throw 404 when email not found or not PENDING', async () => {
      Email.findOneAndUpdate.mockResolvedValue(null);
      await expect(
        EmailService.markEmailStarted(new mongoose.Types.ObjectId()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should atomically update PENDING to SENDING', async () => {
      const emailDoc = {
        _id: new mongoose.Types.ObjectId(),
        status: EMAIL_CONFIG.EMAIL_STATUSES.SENDING,
      };
      Email.findOneAndUpdate.mockResolvedValue(emailDoc);

      const result = await EmailService.markEmailStarted(emailDoc._id);
      expect(result).toEqual(emailDoc);
      expect(Email.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: emailDoc._id, status: EMAIL_CONFIG.EMAIL_STATUSES.PENDING },
        expect.objectContaining({ status: EMAIL_CONFIG.EMAIL_STATUSES.SENDING }),
        { new: true },
      );
    });
  });

  // ── markEmailCompleted ───────────────────────────────────────────────
  describe('markEmailCompleted', () => {
    it('should throw 404 when email not found', async () => {
      Email.findByIdAndUpdate.mockResolvedValue(null);
      await expect(
        EmailService.markEmailCompleted(
          new mongoose.Types.ObjectId(),
          EMAIL_CONFIG.EMAIL_STATUSES.SENT,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should set the provided valid finalStatus', async () => {
      const emailDoc = { _id: new mongoose.Types.ObjectId() };
      Email.findByIdAndUpdate.mockResolvedValue(emailDoc);

      await EmailService.markEmailCompleted(emailDoc._id, EMAIL_CONFIG.EMAIL_STATUSES.FAILED);
      expect(Email.findByIdAndUpdate).toHaveBeenCalledWith(
        emailDoc._id,
        expect.objectContaining({ status: EMAIL_CONFIG.EMAIL_STATUSES.FAILED }),
        { new: true },
      );
    });

    it('should fallback to SENT for invalid finalStatus', async () => {
      const emailDoc = { _id: new mongoose.Types.ObjectId() };
      Email.findByIdAndUpdate.mockResolvedValue(emailDoc);

      await EmailService.markEmailCompleted(emailDoc._id, 'INVALID');
      expect(Email.findByIdAndUpdate).toHaveBeenCalledWith(
        emailDoc._id,
        expect.objectContaining({ status: EMAIL_CONFIG.EMAIL_STATUSES.SENT }),
        { new: true },
      );
    });
  });

  // ── markEmailPending ─────────────────────────────────────────────────
  describe('markEmailPending', () => {
    it('should throw 404 when email not found', async () => {
      Email.findByIdAndUpdate.mockResolvedValue(null);
      await expect(
        EmailService.markEmailPending(new mongoose.Types.ObjectId()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should reset to PENDING and clear timing fields', async () => {
      const emailDoc = { _id: new mongoose.Types.ObjectId() };
      Email.findByIdAndUpdate.mockResolvedValue(emailDoc);

      const result = await EmailService.markEmailPending(emailDoc._id);
      expect(result).toEqual(emailDoc);
      expect(Email.findByIdAndUpdate).toHaveBeenCalledWith(
        emailDoc._id,
        expect.objectContaining({
          status: EMAIL_CONFIG.EMAIL_STATUSES.PENDING,
          startedAt: null,
          completedAt: null,
        }),
        { new: true },
      );
    });
  });

  // ── getAllEmails ──────────────────────────────────────────────────────
  describe('getAllEmails', () => {
    it('should return empty array when no emails exist', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      Email.find.mockReturnValue(mockQuery);

      const result = await EmailService.getAllEmails();
      expect(result).toEqual([]);
    });

    it('should return emails with aggregated counts', async () => {
      const emailId = new mongoose.Types.ObjectId();
      const emails = [{ _id: emailId, subject: 'Test' }];
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(emails),
      };
      Email.find.mockReturnValue(mockQuery);

      // First aggregate call: total recipients
      EmailBatch.aggregate
        .mockResolvedValueOnce([{ _id: null, totalRecipients: 10 }])
        // Second aggregate call: batch counts by status
        .mockResolvedValueOnce([
          { _id: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT, batchCount: 3 },
          { _id: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.FAILED, batchCount: 1 },
        ]);

      const result = await EmailService.getAllEmails();
      expect(result).toHaveLength(1);
      expect(result[0].totalEmails).toBe(10);
      expect(result[0].sentEmails).toBe(3);
      expect(result[0].failedEmails).toBe(1);
    });

    it('should handle emails with no batches (zero counts)', async () => {
      const emails = [{ _id: new mongoose.Types.ObjectId(), subject: 'No Batches' }];
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(emails),
      };
      Email.find.mockReturnValue(mockQuery);

      EmailBatch.aggregate
        .mockResolvedValueOnce([]) // No recipients
        .mockResolvedValueOnce([]); // No batch counts

      const result = await EmailService.getAllEmails();
      expect(result[0].totalEmails).toBe(0);
      expect(result[0].sentEmails).toBe(0);
      expect(result[0].failedEmails).toBe(0);
    });
  });

  // ── getPendingEmails ────────────────────────────────────────────────
  describe('getPendingEmails', () => {
    it('should return PENDING emails sorted by createdAt ascending', async () => {
      const emails = [
        { _id: new mongoose.Types.ObjectId(), status: EMAIL_CONFIG.EMAIL_STATUSES.PENDING },
      ];
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(emails),
      };
      Email.find.mockReturnValue(mockQuery);

      const result = await EmailService.getPendingEmails();
      expect(result).toEqual(emails);
      expect(Email.find).toHaveBeenCalledWith({ status: EMAIL_CONFIG.EMAIL_STATUSES.PENDING });
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: 1 });
    });
  });

  // ── getStuckEmails ──────────────────────────────────────────────────
  describe('getStuckEmails', () => {
    it('should return SENDING emails sorted by startedAt ascending', async () => {
      const emails = [
        { _id: new mongoose.Types.ObjectId(), status: EMAIL_CONFIG.EMAIL_STATUSES.SENDING },
      ];
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(emails),
      };
      Email.find.mockReturnValue(mockQuery);

      const result = await EmailService.getStuckEmails();
      expect(result).toEqual(emails);
      expect(Email.find).toHaveBeenCalledWith({ status: EMAIL_CONFIG.EMAIL_STATUSES.SENDING });
      expect(mockQuery.sort).toHaveBeenCalledWith({ startedAt: 1 });
    });
  });

  // ── resetStuckEmail ─────────────────────────────────────────────────
  describe('resetStuckEmail', () => {
    it('should throw 404 when email not found', async () => {
      Email.findByIdAndUpdate.mockResolvedValue(null);
      await expect(
        EmailService.resetStuckEmail(new mongoose.Types.ObjectId()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should reset to PENDING and clear startedAt', async () => {
      const emailDoc = { _id: new mongoose.Types.ObjectId() };
      Email.findByIdAndUpdate.mockResolvedValue(emailDoc);

      const result = await EmailService.resetStuckEmail(emailDoc._id);
      expect(result).toEqual(emailDoc);
      expect(Email.findByIdAndUpdate).toHaveBeenCalledWith(
        emailDoc._id,
        expect.objectContaining({
          status: EMAIL_CONFIG.EMAIL_STATUSES.PENDING,
          startedAt: null,
        }),
        { new: true },
      );
    });
  });
});
