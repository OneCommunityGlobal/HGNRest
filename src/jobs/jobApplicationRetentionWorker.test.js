jest.mock('mongoose', () => ({
  connection: { readyState: 1 },
}));

jest.mock('../models/jobApplicationsModel', () => ({
  findById: jest.fn(),
  deleteOne: jest.fn(),
}));

jest.mock('../utilities/AzureBlobImages', () => ({
  deleteApplicationBlob: jest.fn(),
}));

jest.mock('../utilities/jobApplicationRetention', () => ({
  getRetentionCutoff: jest.fn(),
  runJobApplicationCleanup: jest.fn(),
  claimExpiredApplication: jest.fn(),
  verifyCleanupClaim: jest.fn(),
  releaseCleanupClaim: jest.fn(),
  isApplicationFileShared: jest.fn(),
  executeApplicationCleanup: jest.fn(),
}));

const mongoose = require('mongoose');
const JobApplications = require('../models/jobApplicationsModel');
const { deleteApplicationBlob } = require('../utilities/AzureBlobImages');
const retention = require('../utilities/jobApplicationRetention');
const {
  deletionIsEnabled,
  cleanupClaimedApplication,
  runRetentionDeletion,
} = require('./jobApplicationRetentionWorker');

describe('Job application retention deletion worker', () => {
  const originalEnv = {
    nodeEnv: process.env.NODE_ENV,
    deleteEnabled: process.env.JOB_APPLICATION_RETENTION_DELETE_ENABLED,
    origin: process.env.JOB_APPLICATION_BLOB_ORIGIN,
    container: process.env.AZURE_STORAGE_CONTAINER_NAME,
  };

  const applicationId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.NODE_ENV = 'production';
    process.env.JOB_APPLICATION_RETENTION_DELETE_ENABLED = 'true';
    process.env.JOB_APPLICATION_BLOB_ORIGIN = 'https://example.blob.core.windows.net';
    process.env.AZURE_STORAGE_CONTAINER_NAME = 'uploads';

    mongoose.connection.readyState = 1;

    retention.claimExpiredApplication.mockResolvedValue({
      claimToken: 'claim-token',
      application: { _id: applicationId },
    });

    retention.verifyCleanupClaim.mockResolvedValue(true);
    retention.isApplicationFileShared.mockResolvedValue(false);
    retention.releaseCleanupClaim.mockResolvedValue(true);
    retention.getRetentionCutoff.mockReturnValue(new Date('2026-09-15T12:00:00Z'));

    JobApplications.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: applicationId,
        submittedAt: new Date('2026-09-01T12:00:00Z'),
      }),
    });

    JobApplications.deleteOne.mockResolvedValue({ deletedCount: 1 });
    deleteApplicationBlob.mockResolvedValue(true);
  });

  afterAll(() => {
    const values = [
      ['NODE_ENV', originalEnv.nodeEnv],
      ['JOB_APPLICATION_RETENTION_DELETE_ENABLED', originalEnv.deleteEnabled],
      ['JOB_APPLICATION_BLOB_ORIGIN', originalEnv.origin],
      ['AZURE_STORAGE_CONTAINER_NAME', originalEnv.container],
    ];

    values.forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  test('disables deletion by default', async () => {
    delete process.env.JOB_APPLICATION_RETENTION_DELETE_ENABLED;

    expect(deletionIsEnabled()).toBe(false);

    await expect(
      cleanupClaimedApplication(applicationId, { allowDeletion: true }),
    ).resolves.toEqual({
      deleted: false,
      reason: 'deletion_disabled',
    });

    expect(retention.claimExpiredApplication).not.toHaveBeenCalled();
    expect(deleteApplicationBlob).not.toHaveBeenCalled();
    expect(JobApplications.deleteOne).not.toHaveBeenCalled();
  });

  test('never deletes outside production', async () => {
    process.env.NODE_ENV = 'test';

    expect(deletionIsEnabled()).toBe(false);

    await expect(runRetentionDeletion()).resolves.toEqual({
      skipped: true,
      reason: 'deletion_disabled',
    });

    expect(retention.runJobApplicationCleanup).not.toHaveBeenCalled();
  });

  test('requires an additional explicit deletion option', async () => {
    await expect(cleanupClaimedApplication(applicationId)).resolves.toEqual({
      deleted: false,
      reason: 'deletion_disabled',
    });

    expect(retention.claimExpiredApplication).not.toHaveBeenCalled();
  });

  test('skips cleanup when another worker owns the claim', async () => {
    retention.claimExpiredApplication.mockResolvedValue(null);

    await expect(
      cleanupClaimedApplication(applicationId, { allowDeletion: true }),
    ).resolves.toEqual({
      deleted: false,
      reason: 'claim_unavailable',
    });

    expect(retention.executeApplicationCleanup).not.toHaveBeenCalled();
  });

  test('performs claim-guarded deletion with mocked operations', async () => {
    retention.executeApplicationCleanup.mockImplementation(async (id, config, operations) => {
      const application = await operations.findApplication(id);
      expect(application._id).toBe(applicationId);

      expect(await operations.checkSharedFile(id, 'resumes/resume.pdf')).toBe(false);

      await operations.deleteBlob('resumes/resume.pdf');
      await operations.deleteApplication(id);

      return {
        deleted: true,
        reason: null,
        deletedBlobCount: 1,
      };
    });

    const result = await cleanupClaimedApplication(applicationId, {
      allowDeletion: true,
    });

    expect(result.deleted).toBe(true);
    expect(deleteApplicationBlob).toHaveBeenCalledWith('resumes/resume.pdf');
    expect(JobApplications.deleteOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: applicationId,
        'cleanup.status': 'processing',
        'cleanup.claimToken': 'claim-token',
      }),
    );

    expect(retention.verifyCleanupClaim).toHaveBeenCalled();
  });

  test('blocks file deletion if a claim expires', async () => {
    retention.verifyCleanupClaim.mockResolvedValue(false);

    retention.executeApplicationCleanup.mockImplementation(async (id, config, operations) => {
      await operations.deleteBlob('resumes/resume.pdf');
    });

    await expect(cleanupClaimedApplication(applicationId, { allowDeletion: true })).rejects.toThrow(
      'Cleanup claim expired',
    );

    expect(deleteApplicationBlob).not.toHaveBeenCalled();
    expect(JobApplications.deleteOne).not.toHaveBeenCalled();
    expect(retention.releaseCleanupClaim).toHaveBeenCalled();
  });

  test('blocks files that become shared during deletion', async () => {
    retention.isApplicationFileShared.mockResolvedValue(true);

    retention.executeApplicationCleanup.mockImplementation(async (id, config, operations) => {
      await operations.deleteBlob('resumes/shared.pdf');
    });

    await expect(cleanupClaimedApplication(applicationId, { allowDeletion: true })).rejects.toThrow(
      'Uploaded file became shared',
    );

    expect(deleteApplicationBlob).not.toHaveBeenCalled();
    expect(JobApplications.deleteOne).not.toHaveBeenCalled();
  });

  test('preserves the record if claim-bound database deletion fails', async () => {
    JobApplications.deleteOne.mockResolvedValue({ deletedCount: 0 });

    retention.executeApplicationCleanup.mockImplementation(async (id, config, operations) => {
      await operations.deleteApplication(id);
    });

    await expect(cleanupClaimedApplication(applicationId, { allowDeletion: true })).rejects.toThrow(
      'Application deletion was not confirmed',
    );

    expect(retention.releaseCleanupClaim).toHaveBeenCalled();
  });

  test('processes an eligible preview batch', async () => {
    retention.runJobApplicationCleanup.mockResolvedValue({
      dryRun: true,
      totalApplications: 1,
      eligibleCount: 1,
      skippedCount: 0,
      nextCursor: null,
      results: [
        {
          applicationId,
          eligible: true,
        },
      ],
    });

    retention.executeApplicationCleanup.mockResolvedValue({
      deleted: true,
      reason: null,
      deletedBlobCount: 0,
    });

    await expect(runRetentionDeletion()).resolves.toEqual({
      dryRun: false,
      batches: 1,
      deleted: 1,
      skipped: 0,
      failed: 0,
    });

    expect(retention.claimExpiredApplication).toHaveBeenCalledWith(applicationId, expect.any(Date));
  });

  test('counts failed applications and continues processing', async () => {
    retention.runJobApplicationCleanup.mockResolvedValue({
      dryRun: true,
      totalApplications: 2,
      eligibleCount: 2,
      skippedCount: 0,
      nextCursor: null,
      results: [
        { applicationId, eligible: true },
        { applicationId: '507f1f77bcf86cd799439012', eligible: true },
      ],
    });

    retention.executeApplicationCleanup
      .mockRejectedValueOnce(new Error('Azure unavailable'))
      .mockResolvedValueOnce({
        deleted: true,
        reason: null,
        deletedBlobCount: 0,
      });

    const result = await runRetentionDeletion();

    expect(result).toEqual({
      dryRun: false,
      batches: 1,
      deleted: 1,
      skipped: 0,
      failed: 1,
    });

    expect(retention.releaseCleanupClaim).toHaveBeenCalled();
  });
});
