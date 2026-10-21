jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

jest.mock('mongoose', () => ({
  connection: { readyState: 1 },
}));

jest.mock('../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

jest.mock('../utilities/jobApplicationRetention', () => ({
  runJobApplicationCleanup: jest.fn(),
}));

jest.mock('./jobApplicationRetentionWorker', () => ({
  runRetentionDeletion: jest.fn(),
}));

const cron = require('node-cron');
const mongoose = require('mongoose');
const { runJobApplicationCleanup } = require('../utilities/jobApplicationRetention');
const {
  runRetentionPreview,
  startJobApplicationRetentionJob,
} = require('./jobApplicationRetentionJob');

describe('Job application retention scheduler', () => {
  const originalEnabled = process.env.JOB_APPLICATION_RETENTION_PREVIEW_ENABLED;
  const originalOrigin = process.env.JOB_APPLICATION_BLOB_ORIGIN;
  const originalContainer = process.env.AZURE_STORAGE_CONTAINER_NAME;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    process.env.JOB_APPLICATION_RETENTION_PREVIEW_ENABLED = 'false';
    process.env.JOB_APPLICATION_BLOB_ORIGIN = 'https://example.blob.core.windows.net';
    process.env.AZURE_STORAGE_CONTAINER_NAME = 'uploads';
  });

  afterAll(() => {
    if (originalEnabled === undefined) {
      delete process.env.JOB_APPLICATION_RETENTION_PREVIEW_ENABLED;
    } else {
      process.env.JOB_APPLICATION_RETENTION_PREVIEW_ENABLED = originalEnabled;
    }

    if (originalOrigin === undefined) {
      delete process.env.JOB_APPLICATION_BLOB_ORIGIN;
    } else {
      process.env.JOB_APPLICATION_BLOB_ORIGIN = originalOrigin;
    }

    if (originalContainer === undefined) {
      delete process.env.AZURE_STORAGE_CONTAINER_NAME;
    } else {
      process.env.AZURE_STORAGE_CONTAINER_NAME = originalContainer;
    }
  });

  test('does not register a job when disabled', () => {
    expect(startJobApplicationRetentionJob()).toBeNull();
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  test('registers a daily UTC preview when enabled', () => {
    process.env.JOB_APPLICATION_RETENTION_PREVIEW_ENABLED = 'true';

    startJobApplicationRetentionJob();

    expect(cron.schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function), {
      timezone: 'Etc/UTC',
    });
  });

  test('skips the preview without a database connection', async () => {
    mongoose.connection.readyState = 0;

    await expect(runRetentionPreview()).resolves.toEqual({
      skipped: true,
      reason: 'database_not_connected',
    });

    expect(runJobApplicationCleanup).not.toHaveBeenCalled();
  });

  test('skips the preview without storage configuration', async () => {
    delete process.env.JOB_APPLICATION_BLOB_ORIGIN;

    await expect(runRetentionPreview()).resolves.toEqual({
      skipped: true,
      reason: 'storage_configuration_missing',
    });

    expect(runJobApplicationCleanup).not.toHaveBeenCalled();
  });

  test('previews expired applications without deleting them', async () => {
    runJobApplicationCleanup.mockResolvedValue({
      dryRun: true,
      totalApplications: 2,
      eligibleCount: 1,
      skippedCount: 1,
      nextCursor: null,
    });

    await expect(runRetentionPreview()).resolves.toEqual({
      dryRun: true,
      inspected: 2,
      eligible: 1,
      skipped: 1,
      batches: 1,
    });

    expect(runJobApplicationCleanup).toHaveBeenCalledTimes(1);
  });

  test('handles multiple pages of expired applications', async () => {
    runJobApplicationCleanup
      .mockResolvedValueOnce({
        dryRun: true,
        totalApplications: 100,
        eligibleCount: 90,
        skippedCount: 10,
        nextCursor: '507f1f77bcf86cd799439011',
      })
      .mockResolvedValueOnce({
        dryRun: true,
        totalApplications: 5,
        eligibleCount: 4,
        skippedCount: 1,
        nextCursor: null,
      });

    const result = await runRetentionPreview();

    expect(result).toEqual({
      dryRun: true,
      inspected: 105,
      eligible: 94,
      skipped: 11,
      batches: 2,
    });

    expect(runJobApplicationCleanup).toHaveBeenCalledTimes(2);
    expect(runJobApplicationCleanup.mock.calls[1][3]).toBe('507f1f77bcf86cd799439011');
  });

  test('rejects repeated pagination cursors', async () => {
    runJobApplicationCleanup
      .mockResolvedValueOnce({
        totalApplications: 100,
        eligibleCount: 100,
        skippedCount: 0,
        nextCursor: '507f1f77bcf86cd799439011',
      })
      .mockResolvedValueOnce({
        totalApplications: 100,
        eligibleCount: 100,
        skippedCount: 0,
        nextCursor: '507f1f77bcf86cd799439011',
      });

    await expect(runRetentionPreview()).rejects.toThrow(
      'Retention preview cursor did not advance.',
    );
  });

  test('runs the gated deletion worker from the scheduled callback', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDeleteEnabled = process.env.JOB_APPLICATION_RETENTION_DELETE_ENABLED;

    try {
      process.env.NODE_ENV = 'production';
      process.env.JOB_APPLICATION_RETENTION_DELETE_ENABLED = 'true';
      process.env.JOB_APPLICATION_RETENTION_PREVIEW_ENABLED = 'false';

      // Reset module state so this test registers its own cron callback.
      jest.resetModules();

      const isolatedCron = require('node-cron');
      const scheduler = require('./jobApplicationRetentionJob');
      const deletionWorker = require('./jobApplicationRetentionWorker');
      const previewUtility = require('../utilities/jobApplicationRetention');

      isolatedCron.schedule.mockClear();

      deletionWorker.runRetentionDeletion.mockResolvedValue({
        dryRun: false,
        batches: 1,
        deleted: 1,
        skipped: 0,
        failed: 0,
      });

      scheduler.startJobApplicationRetentionJob();

      expect(isolatedCron.schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function), {
        timezone: 'Etc/UTC',
      });

      const [, scheduledCallback] = isolatedCron.schedule.mock.calls[0];

      // Execute only the mocked scheduled callback.
      await scheduledCallback();

      expect(deletionWorker.runRetentionDeletion).toHaveBeenCalledTimes(1);
      expect(previewUtility.runJobApplicationCleanup).not.toHaveBeenCalled();
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }

      if (originalDeleteEnabled === undefined) {
        delete process.env.JOB_APPLICATION_RETENTION_DELETE_ENABLED;
      } else {
        process.env.JOB_APPLICATION_RETENTION_DELETE_ENABLED = originalDeleteEnabled;
      }
    }
  });
});
