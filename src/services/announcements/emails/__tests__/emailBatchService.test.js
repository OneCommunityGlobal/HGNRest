const mongoose = require('mongoose');
const EmailBatchService = require('../emailBatchService');
const EmailBatch = require('../../../../models/emailBatch');
const Email = require('../../../../models/email');
const { EMAIL_CONFIG } = require('../../../../config/emailConfig');

// Mock models
jest.mock('../../../../models/emailBatch');
jest.mock('../../../../models/email');

describe('EmailBatchService', () => {
  beforeEach(() => {
    // Manually mock mongoose model statics (jest.mock alone doesn't mock these)
    EmailBatch.insertMany = jest.fn();
    EmailBatch.find = jest.fn();
    EmailBatch.findById = jest.fn();
    EmailBatch.findByIdAndUpdate = jest.fn();
    EmailBatch.findOneAndUpdate = jest.fn();

    Email.findById = jest.fn();
    Email.findByIdAndUpdate = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── createEmailBatches ────────────────────────────────────────────────
  describe('createEmailBatches', () => {
    const validEmailId = new mongoose.Types.ObjectId();

    it('should throw 404 when emailId is invalid', async () => {
      await expect(
        EmailBatchService.createEmailBatches('invalid-id', ['a@b.com']),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Email not found'),
        statusCode: 404,
      });
    });

    it('should throw 404 when emailId is null', async () => {
      await expect(EmailBatchService.createEmailBatches(null, ['a@b.com'])).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 400 when recipients is empty array', async () => {
      await expect(EmailBatchService.createEmailBatches(validEmailId, [])).rejects.toMatchObject({
        message: 'At least one recipient is required',
        statusCode: 400,
      });
    });

    it('should throw 400 when all recipients have invalid email format', async () => {
      await expect(
        EmailBatchService.createEmailBatches(validEmailId, ['not-an-email']),
      ).rejects.toMatchObject({
        message: 'One or more recipient emails are invalid',
        statusCode: 400,
      });
    });

    it('should normalise string recipients to { email } objects and call insertMany', async () => {
      const recipients = ['one@test.com', 'two@test.com'];
      const inserted = recipients.map((email, i) => ({
        _id: new mongoose.Types.ObjectId(),
        emailId: validEmailId,
        recipients: [{ email }],
        emailType: EMAIL_CONFIG.EMAIL_TYPES.BCC,
        status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.PENDING,
      }));
      EmailBatch.insertMany.mockResolvedValue(inserted);

      const result = await EmailBatchService.createEmailBatches(validEmailId, recipients);

      expect(EmailBatch.insertMany).toHaveBeenCalledTimes(1);
      // default batch size is 100, so 2 recipients → 1 batch item
      const calledItems = EmailBatch.insertMany.mock.calls[0][0];
      expect(calledItems).toHaveLength(1);
      expect(calledItems[0].recipients).toEqual([
        { email: 'one@test.com' },
        { email: 'two@test.com' },
      ]);
      expect(result).toEqual(inserted);
    });

    it('should chunk recipients by custom batchSize', async () => {
      const recipients = ['a@t.com', 'b@t.com', 'c@t.com'];
      EmailBatch.insertMany.mockResolvedValue([{}, {}]);

      await EmailBatchService.createEmailBatches(validEmailId, recipients, { batchSize: 2 });

      const calledItems = EmailBatch.insertMany.mock.calls[0][0];
      expect(calledItems).toHaveLength(2); // 3 recipients / 2 = 2 chunks
      expect(calledItems[0].recipients).toHaveLength(2);
      expect(calledItems[1].recipients).toHaveLength(1);
    });

    it('should use configured emailType when provided', async () => {
      EmailBatch.insertMany.mockResolvedValue([{}]);

      await EmailBatchService.createEmailBatches(validEmailId, ['a@t.com'], {
        emailType: EMAIL_CONFIG.EMAIL_TYPES.CC,
      });

      const calledItems = EmailBatch.insertMany.mock.calls[0][0];
      expect(calledItems[0].emailType).toBe(EMAIL_CONFIG.EMAIL_TYPES.CC);
    });

    it('should pass session to insertMany when provided', async () => {
      const mockSession = { id: 'session-1' };
      EmailBatch.insertMany.mockResolvedValue([{}]);

      await EmailBatchService.createEmailBatches(validEmailId, ['a@t.com'], {}, mockSession);

      expect(EmailBatch.insertMany).toHaveBeenCalledWith(expect.any(Array), {
        session: mockSession,
      });
    });

    it('should throw 400 when insertMany returns ValidationError', async () => {
      const dbError = new Error('Validation failed');
      dbError.name = 'ValidationError';
      EmailBatch.insertMany.mockRejectedValue(dbError);

      await expect(
        EmailBatchService.createEmailBatches(validEmailId, ['a@b.com']),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 409 when insertMany returns duplicate key error', async () => {
      const dbError = new Error('dup key');
      dbError.code = 11000;
      EmailBatch.insertMany.mockRejectedValue(dbError);

      await expect(
        EmailBatchService.createEmailBatches(validEmailId, ['a@b.com']),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should throw 500 for other DB errors', async () => {
      const dbError = new Error('connection lost');
      EmailBatch.insertMany.mockRejectedValue(dbError);

      await expect(
        EmailBatchService.createEmailBatches(validEmailId, ['a@b.com']),
      ).rejects.toMatchObject({ statusCode: 500 });
    });

    it('should accept { email } objects as recipients', async () => {
      const recipients = [{ email: 'x@y.com' }];
      EmailBatch.insertMany.mockResolvedValue([{}]);

      await EmailBatchService.createEmailBatches(validEmailId, recipients);

      const calledItems = EmailBatch.insertMany.mock.calls[0][0];
      expect(calledItems[0].recipients).toEqual([{ email: 'x@y.com' }]);
    });

    it('should throw 400 when recipient count exceeds MAX_RECIPIENTS_PER_REQUEST', async () => {
      const max = EMAIL_CONFIG.LIMITS.MAX_RECIPIENTS_PER_REQUEST;
      const tooMany = Array.from({ length: max + 1 }, (_, i) => `user${i}@test.com`);

      await expect(
        EmailBatchService.createEmailBatches(validEmailId, tooMany),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should skip recipient limit when enforceRecipientLimit is false', async () => {
      const max = EMAIL_CONFIG.LIMITS.MAX_RECIPIENTS_PER_REQUEST;
      const tooMany = Array.from({ length: max + 1 }, (_, i) => `user${i}@test.com`);
      EmailBatch.insertMany.mockResolvedValue([{}]);

      await expect(
        EmailBatchService.createEmailBatches(validEmailId, tooMany, {
          enforceRecipientLimit: false,
        }),
      ).resolves.toBeDefined();
    });
  });

  // ── getEmailWithBatches ───────────────────────────────────────────────
  describe('getEmailWithBatches', () => {
    const validId = new mongoose.Types.ObjectId();

    it('should throw 400 for invalid emailId', async () => {
      await expect(EmailBatchService.getEmailWithBatches('bad')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 when email not found', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      };
      Email.findById.mockReturnValue(mockQuery);

      await expect(EmailBatchService.getEmailWithBatches(validId)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should return email and transformed batches', async () => {
      const emailDoc = { _id: validId, subject: 'Hi' };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(emailDoc),
      };
      Email.findById.mockReturnValue(mockQuery);

      const batchDoc = {
        _id: new mongoose.Types.ObjectId(),
        emailId: validId,
        recipients: [{ email: 'a@b.com' }],
        status: 'SENT',
        attempts: 1,
        lastAttemptedAt: new Date(),
        sentAt: new Date(),
        failedAt: null,
        lastError: null,
        lastErrorAt: null,
        errorCode: null,
        sendResponse: null,
        emailType: 'BCC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock getBatchesForEmail via EmailBatch.find
      const mockSort = jest.fn().mockResolvedValue([batchDoc]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });

      const result = await EmailBatchService.getEmailWithBatches(validId);

      expect(result.email).toEqual(emailDoc);
      expect(result.batches).toHaveLength(1);
      expect(result.batches[0]).toHaveProperty('_id', batchDoc._id);
      expect(result.batches[0]).toHaveProperty('status', 'SENT');
    });
  });

  // ── getBatchesForEmail ────────────────────────────────────────────────
  describe('getBatchesForEmail', () => {
    it('should throw 400 for invalid emailId', async () => {
      await expect(EmailBatchService.getBatchesForEmail('bad')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should call find and sort by createdAt ascending', async () => {
      const mockSort = jest.fn().mockResolvedValue([]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });

      const id = new mongoose.Types.ObjectId();
      await EmailBatchService.getBatchesForEmail(id);

      expect(EmailBatch.find).toHaveBeenCalledWith({ emailId: id });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: 1 });
    });
  });

  // ── getPendingBatchesForEmail ─────────────────────────────────────────
  describe('getPendingBatchesForEmail', () => {
    it('should throw 400 for invalid emailId', async () => {
      await expect(EmailBatchService.getPendingBatchesForEmail(null)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should filter by PENDING status', async () => {
      const mockSort = jest.fn().mockResolvedValue([]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });
      const id = new mongoose.Types.ObjectId();

      await EmailBatchService.getPendingBatchesForEmail(id);

      expect(EmailBatch.find).toHaveBeenCalledWith({
        emailId: id,
        status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.PENDING,
      });
    });
  });

  // ── getBatchById ──────────────────────────────────────────────────────
  describe('getBatchById', () => {
    it('should throw 400 for invalid batchId', async () => {
      await expect(EmailBatchService.getBatchById('xxx')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should call findById', async () => {
      const id = new mongoose.Types.ObjectId();
      EmailBatch.findById.mockResolvedValue({ _id: id });

      const result = await EmailBatchService.getBatchById(id);
      expect(EmailBatch.findById).toHaveBeenCalledWith(id);
      expect(result._id).toEqual(id);
    });
  });

  // ── getFailedBatchesForEmail ──────────────────────────────────────────
  describe('getFailedBatchesForEmail', () => {
    it('should throw 400 for invalid emailId', async () => {
      await expect(EmailBatchService.getFailedBatchesForEmail('bad')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should filter by FAILED status', async () => {
      const mockSort = jest.fn().mockResolvedValue([]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });
      const id = new mongoose.Types.ObjectId();

      await EmailBatchService.getFailedBatchesForEmail(id);

      expect(EmailBatch.find).toHaveBeenCalledWith({
        emailId: id,
        status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.FAILED,
      });
    });
  });

  // ── getStuckBatches ───────────────────────────────────────────────────
  describe('getStuckBatches', () => {
    it('should filter by SENDING status and sort by lastAttemptedAt', async () => {
      const mockSort = jest.fn().mockResolvedValue([]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });

      await EmailBatchService.getStuckBatches();

      expect(EmailBatch.find).toHaveBeenCalledWith({
        status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENDING,
      });
      expect(mockSort).toHaveBeenCalledWith({ lastAttemptedAt: 1 });
    });
  });

  // ── resetEmailBatchForRetry ───────────────────────────────────────────
  describe('resetEmailBatchForRetry', () => {
    it('should throw 400 for invalid batchId', async () => {
      await expect(EmailBatchService.resetEmailBatchForRetry('bad')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 when batch not found', async () => {
      EmailBatch.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        EmailBatchService.resetEmailBatchForRetry(new mongoose.Types.ObjectId()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should reset status to PENDING and clear error fields', async () => {
      const id = new mongoose.Types.ObjectId();
      const updatedDoc = { _id: id, status: 'PENDING' };
      EmailBatch.findByIdAndUpdate.mockResolvedValue(updatedDoc);

      const result = await EmailBatchService.resetEmailBatchForRetry(id);

      expect(result).toEqual(updatedDoc);
      const updateArg = EmailBatch.findByIdAndUpdate.mock.calls[0][1];
      expect(updateArg.status).toBe(EMAIL_CONFIG.EMAIL_BATCH_STATUSES.PENDING);
      expect(updateArg.attempts).toBe(0);
      expect(updateArg.lastError).toBeNull();
      expect(updateArg.errorCode).toBeNull();
      expect(updateArg.failedAt).toBeNull();
    });
  });

  // ── markEmailBatchSending ─────────────────────────────────────────────
  describe('markEmailBatchSending', () => {
    it('should throw 404 when batch not found or not PENDING', async () => {
      EmailBatch.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        EmailBatchService.markEmailBatchSending(new mongoose.Types.ObjectId()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should update status to SENDING and increment attempts', async () => {
      const id = new mongoose.Types.ObjectId();
      const updatedDoc = { _id: id, status: 'SENDING', attempts: 1 };
      EmailBatch.findOneAndUpdate.mockResolvedValue(updatedDoc);

      const result = await EmailBatchService.markEmailBatchSending(id);

      expect(result).toEqual(updatedDoc);
      const filter = EmailBatch.findOneAndUpdate.mock.calls[0][0];
      expect(filter._id).toBe(id);
      expect(filter.status).toBe(EMAIL_CONFIG.EMAIL_BATCH_STATUSES.PENDING);

      const update = EmailBatch.findOneAndUpdate.mock.calls[0][1];
      expect(update.status).toBe(EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENDING);
      expect(update.$inc).toEqual({ attempts: 1 });
    });
  });

  // ── markEmailBatchSent ────────────────────────────────────────────────
  describe('markEmailBatchSent', () => {
    it('should throw 400 for invalid batchId', async () => {
      await expect(EmailBatchService.markEmailBatchSent('bad')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 when batch not found (not even exists)', async () => {
      EmailBatch.findOneAndUpdate.mockResolvedValue(null);
      EmailBatch.findById.mockResolvedValue(null);

      await expect(
        EmailBatchService.markEmailBatchSent(new mongoose.Types.ObjectId()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should return current batch when not in SENDING status (idempotent)', async () => {
      const id = new mongoose.Types.ObjectId();
      EmailBatch.findOneAndUpdate.mockResolvedValue(null);
      const existingBatch = { _id: id, status: 'SENT' };
      EmailBatch.findById.mockResolvedValue(existingBatch);

      const result = await EmailBatchService.markEmailBatchSent(id);
      expect(result).toEqual(existingBatch);
    });

    it('should set status to SENT with sentAt timestamp', async () => {
      const id = new mongoose.Types.ObjectId();
      const updatedDoc = { _id: id, status: 'SENT' };
      EmailBatch.findOneAndUpdate.mockResolvedValue(updatedDoc);

      const result = await EmailBatchService.markEmailBatchSent(id);
      expect(result).toEqual(updatedDoc);

      const filter = EmailBatch.findOneAndUpdate.mock.calls[0][0];
      expect(filter.status).toBe(EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENDING);
    });

    it('should include attemptCount and sendResponse when provided', async () => {
      const id = new mongoose.Types.ObjectId();
      EmailBatch.findOneAndUpdate.mockResolvedValue({ _id: id });

      await EmailBatchService.markEmailBatchSent(id, {
        attemptCount: 3,
        sendResponse: { messageId: 'abc' },
      });

      const update = EmailBatch.findOneAndUpdate.mock.calls[0][1];
      expect(update.attempts).toBe(3);
      expect(update.sendResponse).toEqual({ messageId: 'abc' });
    });
  });

  // ── markEmailBatchFailed ──────────────────────────────────────────────
  describe('markEmailBatchFailed', () => {
    it('should throw 400 for invalid batchId', async () => {
      await expect(EmailBatchService.markEmailBatchFailed('bad', {})).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 when batch doesnt exist at all', async () => {
      EmailBatch.findOneAndUpdate.mockResolvedValue(null);
      EmailBatch.findById.mockResolvedValue(null);

      await expect(
        EmailBatchService.markEmailBatchFailed(new mongoose.Types.ObjectId(), {
          errorCode: 'SMTP_ERR',
          errorMessage: 'fail',
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should return current batch when already in final state (idempotent)', async () => {
      const id = new mongoose.Types.ObjectId();
      EmailBatch.findOneAndUpdate.mockResolvedValue(null);
      const existingBatch = { _id: id, status: 'FAILED' };
      EmailBatch.findById.mockResolvedValue(existingBatch);

      const result = await EmailBatchService.markEmailBatchFailed(id, {
        errorCode: 'ERR',
        errorMessage: 'msg',
      });
      expect(result).toEqual(existingBatch);
    });

    it('should set status to FAILED with error details', async () => {
      const id = new mongoose.Types.ObjectId();
      const updatedDoc = { _id: id, status: 'FAILED' };
      EmailBatch.findOneAndUpdate.mockResolvedValue(updatedDoc);

      const result = await EmailBatchService.markEmailBatchFailed(id, {
        errorCode: 'SMTP_500',
        errorMessage: 'Server down',
        attemptCount: 2,
      });

      expect(result).toEqual(updatedDoc);
      const update = EmailBatch.findOneAndUpdate.mock.calls[0][1];
      expect(update.status).toBe(EMAIL_CONFIG.EMAIL_BATCH_STATUSES.FAILED);
      expect(update.lastError).toBe('Server down');
      expect(update.errorCode).toBe('SMTP_500');
      expect(update.attempts).toBe(2);
    });

    it('should truncate errorMessage to 500 chars and errorCode to 1000 chars', async () => {
      const id = new mongoose.Types.ObjectId();
      EmailBatch.findOneAndUpdate.mockResolvedValue({ _id: id });

      const longMessage = 'x'.repeat(600);
      const longCode = 'y'.repeat(1100);

      await EmailBatchService.markEmailBatchFailed(id, {
        errorCode: longCode,
        errorMessage: longMessage,
      });

      const update = EmailBatch.findOneAndUpdate.mock.calls[0][1];
      expect(update.lastError.length).toBe(500);
      expect(update.errorCode.length).toBe(1000);
    });
  });

  // ── determineEmailStatus ──────────────────────────────────────────────
  describe('determineEmailStatus', () => {
    const emailId = new mongoose.Types.ObjectId();

    it('should throw 400 for invalid emailId', async () => {
      await expect(EmailBatchService.determineEmailStatus('bad')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should return FAILED when no batches exist', async () => {
      const mockSort = jest.fn().mockResolvedValue([]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });

      const status = await EmailBatchService.determineEmailStatus(emailId);
      expect(status).toBe(EMAIL_CONFIG.EMAIL_STATUSES.FAILED);
    });

    it('should return SENDING when there are pending batches', async () => {
      const mockSort = jest
        .fn()
        .mockResolvedValue([
          { status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT },
          { status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.PENDING },
        ]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });

      const status = await EmailBatchService.determineEmailStatus(emailId);
      expect(status).toBe(EMAIL_CONFIG.EMAIL_STATUSES.SENDING);
    });

    it('should return SENDING when there are sending batches', async () => {
      const mockSort = jest
        .fn()
        .mockResolvedValue([{ status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENDING }]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });

      const status = await EmailBatchService.determineEmailStatus(emailId);
      expect(status).toBe(EMAIL_CONFIG.EMAIL_STATUSES.SENDING);
    });

    it('should return SENT when all batches are SENT', async () => {
      const mockSort = jest
        .fn()
        .mockResolvedValue([
          { status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT },
          { status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT },
        ]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });

      const status = await EmailBatchService.determineEmailStatus(emailId);
      expect(status).toBe(EMAIL_CONFIG.EMAIL_STATUSES.SENT);
    });

    it('should return FAILED when all batches are FAILED', async () => {
      const mockSort = jest
        .fn()
        .mockResolvedValue([
          { status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.FAILED },
          { status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.FAILED },
        ]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });

      const status = await EmailBatchService.determineEmailStatus(emailId);
      expect(status).toBe(EMAIL_CONFIG.EMAIL_STATUSES.FAILED);
    });

    it('should return PROCESSED when mixed SENT and FAILED', async () => {
      const mockSort = jest
        .fn()
        .mockResolvedValue([
          { status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT },
          { status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.FAILED },
        ]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });

      const status = await EmailBatchService.determineEmailStatus(emailId);
      expect(status).toBe(EMAIL_CONFIG.EMAIL_STATUSES.PROCESSED);
    });
  });

  // ── syncParentEmailStatus ─────────────────────────────────────────────
  describe('syncParentEmailStatus', () => {
    const emailId = new mongoose.Types.ObjectId();

    it('should throw 400 for invalid emailId', async () => {
      await expect(EmailBatchService.syncParentEmailStatus('bad')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should set completedAt for final states (SENT)', async () => {
      // Mock determineEmailStatus → SENT
      const mockSort = jest
        .fn()
        .mockResolvedValue([{ status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT }]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });

      const updatedEmail = { _id: emailId, status: 'SENT' };
      Email.findByIdAndUpdate.mockResolvedValue(updatedEmail);

      const result = await EmailBatchService.syncParentEmailStatus(emailId);

      expect(result).toEqual(updatedEmail);
      const updateFields = Email.findByIdAndUpdate.mock.calls[0][1];
      expect(updateFields.status).toBe(EMAIL_CONFIG.EMAIL_STATUSES.SENT);
      expect(updateFields.completedAt).toBeDefined();
    });

    it('should NOT set completedAt for non-final states (SENDING)', async () => {
      const mockSort = jest
        .fn()
        .mockResolvedValue([{ status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.PENDING }]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });

      Email.findByIdAndUpdate.mockResolvedValue({ _id: emailId });

      await EmailBatchService.syncParentEmailStatus(emailId);

      const updateFields = Email.findByIdAndUpdate.mock.calls[0][1];
      expect(updateFields.status).toBe(EMAIL_CONFIG.EMAIL_STATUSES.SENDING);
      expect(updateFields.completedAt).toBeUndefined();
    });

    it('should return null when email not found', async () => {
      const mockSort = jest
        .fn()
        .mockResolvedValue([{ status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT }]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });
      Email.findByIdAndUpdate.mockResolvedValue(null);

      const result = await EmailBatchService.syncParentEmailStatus(emailId);
      expect(result).toBeNull();
    });

    it('should set completedAt for PROCESSED status', async () => {
      const mockSort = jest
        .fn()
        .mockResolvedValue([
          { status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT },
          { status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.FAILED },
        ]);
      EmailBatch.find.mockReturnValue({ sort: mockSort });
      Email.findByIdAndUpdate.mockResolvedValue({ _id: emailId, status: 'PROCESSED' });

      await EmailBatchService.syncParentEmailStatus(emailId);

      const updateFields = Email.findByIdAndUpdate.mock.calls[0][1];
      expect(updateFields.status).toBe(EMAIL_CONFIG.EMAIL_STATUSES.PROCESSED);
      expect(updateFields.completedAt).toBeDefined();
    });
  });
});
