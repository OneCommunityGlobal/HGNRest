const mongoose = require('mongoose');
const EmailThread = require('./emailThread');
const EmailHistory = require('./emailHistory');

describe('Email Models', () => {
  describe('EmailThread Model', () => {
    it('should create a valid EmailThread document', () => {
      const threadData = {
        threadKey: 'blue_square_assignment:user123:2025-11-16',
        threadRootMessageId: '<thread-root@onecommunityglobal.org>',
        weekStart: '2025-11-16',
        emailType: 'blue_square_assignment',
        recipientUserId: new mongoose.Types.ObjectId(),
        createdBy: 'system',
        metadata: { description: 'Test thread' },
      };

      const thread = new EmailThread(threadData);

      expect(thread.threadKey).toBe(threadData.threadKey);
      expect(thread.threadRootMessageId).toBe(threadData.threadRootMessageId);
      expect(thread.weekStart).toBe(threadData.weekStart);
      expect(thread.emailType).toBe(threadData.emailType);
      expect(thread.createdBy).toBe('system');
    });

    it('should require threadKey field', () => {
      const thread = new EmailThread({
        threadRootMessageId: '<thread@test.com>',
        weekStart: '2025-11-16',
      });

      const validationError = thread.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.threadKey).toBeDefined();
    });

    it('should require threadRootMessageId field', () => {
      const thread = new EmailThread({
        threadKey: 'test:user:2025-11-16',
        weekStart: '2025-11-16',
      });

      const validationError = thread.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.threadRootMessageId).toBeDefined();
    });

    it('should require weekStart field', () => {
      const thread = new EmailThread({
        threadKey: 'test:user:2025-11-16',
        threadRootMessageId: '<thread@test.com>',
      });

      const validationError = thread.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.weekStart).toBeDefined();
    });

    it('should only accept valid emailType enum values', () => {
      const thread = new EmailThread({
        threadKey: 'test:user:2025-11-16',
        threadRootMessageId: '<thread@test.com>',
        weekStart: '2025-11-16',
        emailType: 'invalid_type',
      });

      const validationError = thread.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.emailType).toBeDefined();
    });

    it('should accept valid emailType enum values', () => {
      const validTypes = ['blue_square_assignment', 'weekly_summary', 'general'];

      validTypes.forEach((type) => {
        const thread = new EmailThread({
          threadKey: `test:user:2025-11-16:${type}`,
          threadRootMessageId: `<thread-${type}@test.com>`,
          weekStart: '2025-11-16',
          emailType: type,
        });

        const validationError = thread.validateSync();
        expect(validationError).toBeUndefined();
      });
    });

    it('should default emailType to general', () => {
      const thread = new EmailThread({
        threadKey: 'test:user:2025-11-16',
        threadRootMessageId: '<thread@test.com>',
        weekStart: '2025-11-16',
      });

      expect(thread.emailType).toBe('general');
    });

    it('should default createdBy to system', () => {
      const thread = new EmailThread({
        threadKey: 'test:user:2025-11-16',
        threadRootMessageId: '<thread@test.com>',
        weekStart: '2025-11-16',
      });

      expect(thread.createdBy).toBe('system');
    });

    it('should trim threadKey and threadRootMessageId', () => {
      const thread = new EmailThread({
        threadKey: '  test:user:2025-11-16  ',
        threadRootMessageId: '  <thread@test.com>  ',
        weekStart: '2025-11-16',
      });

      expect(thread.threadKey).toBe('test:user:2025-11-16');
      expect(thread.threadRootMessageId).toBe('<thread@test.com>');
    });

    it('should store metadata as flexible object', () => {
      const metadata = {
        description: 'Weekly thread',
        attempts: 3,
        customField: 'custom value',
      };

      const thread = new EmailThread({
        threadKey: 'test:user:2025-11-16',
        threadRootMessageId: '<thread@test.com>',
        weekStart: '2025-11-16',
        metadata,
      });

      expect(thread.metadata).toEqual(metadata);
    });
  });

  describe('EmailHistory Model', () => {
    it('should create a valid EmailHistory document', () => {
      const historyData = {
        uniqueKey: 'unique-key-123',
        to: ['user@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        message: '<p>Test message</p>',
        status: 'SENT',
        messageId: '<msg-123@test.com>',
        threadRootMessageId: '<thread@test.com>',
        references: ['<ref1@test.com>', '<ref2@test.com>'],
        recipientUserId: new mongoose.Types.ObjectId(),
        weekStart: '2025-11-16',
        threadKey: 'blue_square_assignment:user123:2025-11-16',
        emailType: 'blue_square_assignment',
      };

      const history = new EmailHistory(historyData);

      expect(history.uniqueKey).toBe(historyData.uniqueKey);
      expect(Array.from(history.to)).toEqual(historyData.to);
      expect(history.subject).toBe(historyData.subject);
      expect(history.status).toBe('SENT');
      expect(history.messageId).toBe(historyData.messageId);
      expect(history.threadRootMessageId).toBe(historyData.threadRootMessageId);
      expect(Array.from(history.references)).toEqual(historyData.references);
    });

    it('should require uniqueKey field', () => {
      const history = new EmailHistory({
        to: ['user@example.com'],
        subject: 'Test',
      });

      const validationError = history.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.uniqueKey).toBeDefined();
    });

    it('should only accept valid status enum values', () => {
      const history = new EmailHistory({
        uniqueKey: 'test-key',
        status: 'INVALID_STATUS',
      });

      const validationError = history.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.status).toBeDefined();
    });

    it('should accept valid status enum values', () => {
      const validStatuses = ['SENT', 'FAILED', 'QUEUED'];

      validStatuses.forEach((status) => {
        const history = new EmailHistory({
          uniqueKey: `test-key-${status}`,
          status,
        });

        const validationError = history.validateSync();
        expect(validationError).toBeUndefined();
      });
    });

    it('should default status to QUEUED', () => {
      const history = new EmailHistory({
        uniqueKey: 'test-key',
      });

      expect(history.status).toBe('QUEUED');
    });

    it('should default attempts to 0', () => {
      const history = new EmailHistory({
        uniqueKey: 'test-key',
      });

      expect(history.attempts).toBe(0);
    });

    it('should default references to empty array', () => {
      const history = new EmailHistory({
        uniqueKey: 'test-key',
      });

      expect(history.references.length).toBe(0);
    });

    it('should only accept valid emailType enum values', () => {
      const history = new EmailHistory({
        uniqueKey: 'test-key',
        emailType: 'invalid_type',
      });

      const validationError = history.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.emailType).toBeDefined();
    });

    it('should accept valid emailType enum values', () => {
      const validTypes = ['blue_square_assignment', 'weekly_summary', 'general', 'password_reset'];

      validTypes.forEach((type) => {
        const history = new EmailHistory({
          uniqueKey: `test-key-${type}`,
          emailType: type,
        });

        const validationError = history.validateSync();
        expect(validationError).toBeUndefined();
      });
    });

    it('should default emailType to general', () => {
      const history = new EmailHistory({
        uniqueKey: 'test-key',
      });

      expect(history.emailType).toBe('general');
    });

    it('should store metadata as flexible object', () => {
      const metadata = {
        userId: 'user123',
        infringementCount: 3,
        customData: { key: 'value' },
      };

      const history = new EmailHistory({
        uniqueKey: 'test-key',
        metadata,
      });

      expect(history.metadata).toEqual(metadata);
    });

    it('should trim messageId and threadRootMessageId', () => {
      const history = new EmailHistory({
        uniqueKey: 'test-key',
        messageId: '  <msg@test.com>  ',
        threadRootMessageId: '  <thread@test.com>  ',
      });

      expect(history.messageId).toBe('<msg@test.com>');
      expect(history.threadRootMessageId).toBe('<thread@test.com>');
    });

    it('should store multiple references in array', () => {
      const references = ['<thread-root@test.com>', '<msg-1@test.com>', '<msg-2@test.com>'];

      const history = new EmailHistory({
        uniqueKey: 'test-key',
        references,
      });

      expect(Array.from(history.references)).toEqual(references);
      expect(history.references.length).toBe(3);
    });
  });
});
