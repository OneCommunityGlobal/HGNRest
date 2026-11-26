jest.mock('../models/jobApplicationsModel');
const mongoose = require('mongoose');
const JobApplications = require('../models/jobApplicationsModel');
const {
  RETENTION_DAYS,
  CLEANUP_BATCH_SIZE,
  getRetentionCutoff,
  previewExpiredApplications,
  collectApplicationFiles,
  assessApplicationCleanup,
  isApplicationFileShared,
  previewApplicationCleanup,
  runJobApplicationCleanup,
  executeApplicationCleanup,
  claimExpiredApplication,
  verifyCleanupClaim,
  releaseCleanupClaim,
} = require('./jobApplicationRetention');

describe('Job application retention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses a 30-day retention period', () => {
    expect(RETENTION_DAYS).toBe(30);
  });

  test('calculates the cutoff exactly 30 days earlier', () => {
    const now = new Date('2026-10-15T12:00:00Z');

    expect(getRetentionCutoff(now).toISOString()).toBe('2026-09-15T12:00:00.000Z');
  });

  test('rejects invalid dates', () => {
    expect(() => getRetentionCutoff(new Date('invalid'))).toThrow('A valid date is required.');
  });

  test('previews expired applications without deleting them', async () => {
    const applications = [
      {
        _id: 'application-1',
        submittedAt: new Date('2026-09-01T12:00:00Z'),
      },
      {
        _id: 'application-2',
        submittedAt: new Date('2026-09-05T12:00:00Z'),
      },
    ];

    const lean = jest.fn().mockResolvedValue(applications);
    const select = jest.fn().mockReturnValue({ lean });

    JobApplications.find.mockReturnValue({ select });

    const result = await previewExpiredApplications(new Date('2026-10-15T12:00:00Z'));

    expect(JobApplications.find).toHaveBeenCalledWith({
      $or: [
        {
          submittedAt: {
            $lt: new Date('2026-09-15T12:00:00Z'),
          },
        },
        {
          submittedAt: null,
          createdAt: {
            $lt: new Date('2026-09-15T12:00:00Z'),
          },
        },
      ],
    });

    expect(result.totalApplications).toBe(2);
    expect(result.applicationIds).toEqual(['application-1', 'application-2']);

    expect(JobApplications.deleteMany).not.toHaveBeenCalled();
    expect(JobApplications.deleteOne).not.toHaveBeenCalled();
  });

  test('blocks cleanup when another application references the same file', async () => {
    const origin = 'https://example.blob.core.windows.net';
    const container = 'uploads';
    const sharedUrl = `${origin}/${container}/resumes/shared.pdf`;

    const lean = jest.fn().mockResolvedValue([
      {
        _id: 'another-application',
        resumeUrl: sharedUrl,
        answers: [],
      },
    ]);

    const select = jest.fn().mockReturnValue({ lean });
    JobApplications.find.mockReturnValue({ select });

    const result = await previewApplicationCleanup(
      [
        {
          _id: 'expired-application',
          submittedAt: new Date('2026-09-01T12:00:00Z'),
          resumeUrl: sharedUrl,
          answers: [],
        },
      ],
      origin,
      container,
      new Date('2026-10-15T12:00:00Z'),
    );

    expect(result).toEqual([
      {
        applicationId: 'expired-application',
        eligible: false,
        reason: 'shared_file_reference',
        blobCount: 1,
      },
    ]);

    expect(JobApplications.deleteOne).not.toHaveBeenCalled();
    expect(JobApplications.deleteMany).not.toHaveBeenCalled();
  });
  test('stops the cleanup preview when shared-file lookup fails', async () => {
    const origin = 'https://example.blob.core.windows.net';
    const container = 'uploads';

    const lean = jest.fn().mockRejectedValue(new Error('Database unavailable'));
    const select = jest.fn().mockReturnValue({ lean });

    JobApplications.find.mockReturnValue({ select });

    const application = {
      _id: 'expired-application',
      submittedAt: new Date('2026-09-01T12:00:00Z'),
      resumeUrl: `${origin}/${container}/resumes/resume.pdf`,
      answers: [],
    };

    await expect(
      previewApplicationCleanup([application], origin, container, new Date('2026-10-15T12:00:00Z')),
    ).rejects.toThrow('Database unavailable');

    expect(JobApplications.deleteOne).not.toHaveBeenCalled();
    expect(JobApplications.deleteMany).not.toHaveBeenCalled();
  });

  test('runs a read-only cleanup preview and reports summary counts', async () => {
    const origin = 'https://example.blob.core.windows.net';
    const container = 'uploads';
    const now = new Date('2026-10-15T12:00:00Z');

    const applications = [
      {
        _id: 'expired-application',
        submittedAt: new Date('2026-09-01T12:00:00Z'),
        answers: [],
      },
      {
        _id: 'invalid-file-application',
        submittedAt: new Date('2026-09-01T12:00:00Z'),
        resumeUrl: 'https://untrusted.example/resumes/file.pdf',
        answers: [],
      },
    ];

    const lean = jest.fn().mockResolvedValue(applications);
    const select = jest.fn().mockReturnValue({ lean });
    const limit = jest.fn().mockReturnValue({ select });
    const sort = jest.fn().mockReturnValue({ limit });

    JobApplications.find.mockReturnValue({ sort });

    const result = await runJobApplicationCleanup(origin, container, now);

    expect(result.dryRun).toBe(true);
    expect(result.totalApplications).toBe(2);
    expect(result.eligibleCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.nextCursor).toBe('invalid-file-application');
    expect(result.cutoff).toEqual(new Date('2026-09-15T12:00:00Z'));

    expect(result.results).toEqual([
      {
        applicationId: 'expired-application',
        eligible: true,
        reason: null,
        blobCount: 0,
      },
      {
        applicationId: 'invalid-file-application',
        eligible: false,
        reason: 'invalid_file_references',
      },
    ]);

    expect(JobApplications.deleteOne).not.toHaveBeenCalled();
    expect(JobApplications.deleteMany).not.toHaveBeenCalled();
  });

  test('limits the cleanup preview to 100 applications', async () => {
    const origin = 'https://example.blob.core.windows.net';
    const container = 'uploads';
    const now = new Date('2026-10-15T12:00:00Z');

    const lean = jest.fn().mockResolvedValue([]);
    const select = jest.fn().mockReturnValue({ lean });
    const limit = jest.fn().mockReturnValue({ select });
    const sort = jest.fn().mockReturnValue({ limit });

    JobApplications.find.mockReturnValue({ sort });

    const result = await runJobApplicationCleanup(origin, container, now);

    expect(CLEANUP_BATCH_SIZE).toBe(100);
    expect(sort).toHaveBeenCalledWith({ _id: 1 });
    expect(limit).toHaveBeenCalledWith(100);
    expect(result.dryRun).toBe(true);
    expect(result.totalApplications).toBe(0);

    expect(JobApplications.deleteOne).not.toHaveBeenCalled();
    expect(JobApplications.deleteMany).not.toHaveBeenCalled();
  });

  test('rejects invalid cleanup cursors before querying MongoDB', async () => {
    const origin = 'https://example.blob.core.windows.net';

    await expect(
      runJobApplicationCleanup(
        origin,
        'uploads',
        new Date('2026-10-15T12:00:00Z'),
        'invalid-cursor',
      ),
    ).rejects.toThrow('Invalid cleanup cursor.');

    expect(JobApplications.find).not.toHaveBeenCalled();
  });

  test('uses a MongoDB ObjectId for the pagination cursor', async () => {
    const cursor = '507f1f77bcf86cd799439011';
    const origin = 'https://example.blob.core.windows.net';

    const lean = jest.fn().mockResolvedValue([]);
    const select = jest.fn().mockReturnValue({ lean });
    const limit = jest.fn().mockReturnValue({ select });
    const sort = jest.fn().mockReturnValue({ limit });

    JobApplications.find.mockReturnValue({ sort });

    const result = await runJobApplicationCleanup(
      origin,
      'uploads',
      new Date('2026-10-15T12:00:00Z'),
      cursor,
    );

    expect(JobApplications.find).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: {
          $gt: new mongoose.Types.ObjectId(cursor),
        },
      }),
    );

    expect(result.nextCursor).toBeNull();
    expect(result.totalApplications).toBe(0);
    expect(result.dryRun).toBe(true);
  });

  describe('executeApplicationCleanup', () => {
    const origin = 'https://example.blob.core.windows.net';
    const container = 'uploads';
    const azureConfig = {
      expectedOrigin: origin,
      containerName: container,
    };
    const now = new Date('2026-10-15T12:00:00Z');

    const createOperations = () => ({
      findApplication: jest.fn(),
      checkSharedFile: jest.fn().mockResolvedValue(false),
      deleteBlob: jest.fn().mockResolvedValue(true),
      deleteApplication: jest.fn().mockResolvedValue(true),
    });

    const expiredApplication = {
      _id: 'application-1',
      submittedAt: new Date('2026-09-01T12:00:00Z'),
      resumeUrl: `${origin}/${container}/resumes/resume.pdf`,
      answers: [],
    };

    test('disables deletion by default', async () => {
      const operations = createOperations();

      const result = await executeApplicationCleanup('application-1', azureConfig, operations);

      expect(result).toEqual({
        deleted: false,
        reason: 'deletion_disabled',
      });

      expect(operations.findApplication).not.toHaveBeenCalled();
      expect(operations.deleteBlob).not.toHaveBeenCalled();
      expect(operations.deleteApplication).not.toHaveBeenCalled();
    });

    test('uses mocked operations to clean an eligible application', async () => {
      const operations = createOperations();
      operations.findApplication.mockResolvedValue(expiredApplication);

      const result = await executeApplicationCleanup('application-1', azureConfig, operations, {
        allowDeletion: true,
        now,
      });

      expect(result).toEqual({
        deleted: true,
        reason: null,
        deletedBlobCount: 1,
      });

      expect(operations.checkSharedFile).toHaveBeenCalledWith(
        'application-1',
        'resumes/resume.pdf',
      );

      expect(operations.deleteBlob).toHaveBeenCalledWith('resumes/resume.pdf');

      expect(operations.deleteApplication).toHaveBeenCalledWith('application-1');
    });

    test('skips applications that are not expired', async () => {
      const operations = createOperations();

      operations.findApplication.mockResolvedValue({
        ...expiredApplication,
        submittedAt: new Date('2026-10-10T12:00:00Z'),
      });

      const result = await executeApplicationCleanup('application-1', azureConfig, operations, {
        allowDeletion: true,
        now,
      });

      expect(result.reason).toBe('not_expired');
      expect(operations.deleteBlob).not.toHaveBeenCalled();
      expect(operations.deleteApplication).not.toHaveBeenCalled();
    });

    test('skips applications with unsafe file references', async () => {
      const operations = createOperations();

      operations.findApplication.mockResolvedValue({
        ...expiredApplication,
        resumeUrl: 'https://untrusted.example/resumes/file.pdf',
      });

      const result = await executeApplicationCleanup('application-1', azureConfig, operations, {
        allowDeletion: true,
        now,
      });

      expect(result.reason).toBe('invalid_file_references');
      expect(operations.deleteBlob).not.toHaveBeenCalled();
      expect(operations.deleteApplication).not.toHaveBeenCalled();
    });

    test('does not delete shared files or their application', async () => {
      const operations = createOperations();
      operations.findApplication.mockResolvedValue(expiredApplication);
      operations.checkSharedFile.mockResolvedValue(true);

      const result = await executeApplicationCleanup('application-1', azureConfig, operations, {
        allowDeletion: true,
        now,
      });

      expect(result.reason).toBe('shared_file_reference');
      expect(operations.deleteBlob).not.toHaveBeenCalled();
      expect(operations.deleteApplication).not.toHaveBeenCalled();
    });

    test('preserves application record when Azure deletion fails', async () => {
      const operations = createOperations();
      operations.findApplication.mockResolvedValue(expiredApplication);
      operations.deleteBlob.mockRejectedValue(new Error('Azure unavailable'));

      await expect(
        executeApplicationCleanup('application-1', azureConfig, operations, {
          allowDeletion: true,
          now,
        }),
      ).rejects.toThrow('Azure unavailable');

      expect(operations.deleteApplication).not.toHaveBeenCalled();
    });

    test('propagates database lookup errors without deleting files', async () => {
      const operations = createOperations();
      operations.findApplication.mockRejectedValue(new Error('Database unavailable'));

      await expect(
        executeApplicationCleanup('application-1', azureConfig, operations, {
          allowDeletion: true,
          now,
        }),
      ).rejects.toThrow('Database unavailable');

      expect(operations.deleteBlob).not.toHaveBeenCalled();
      expect(operations.deleteApplication).not.toHaveBeenCalled();
    });

    test('propagates shared-file check failures without deleting files', async () => {
      const operations = createOperations();
      operations.findApplication.mockResolvedValue(expiredApplication);
      operations.checkSharedFile.mockRejectedValue(new Error('Shared-file check failed'));

      await expect(
        executeApplicationCleanup('application-1', azureConfig, operations, {
          allowDeletion: true,
          now,
        }),
      ).rejects.toThrow('Shared-file check failed');

      expect(operations.deleteBlob).not.toHaveBeenCalled();
      expect(operations.deleteApplication).not.toHaveBeenCalled();
    });
  });

  describe('claimExpiredApplication', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    const applicationId = '507f1f77bcf86cd799439011';

    const mockClaimQuery = (result) => {
      const lean = jest.fn().mockResolvedValue(result);
      JobApplications.findOneAndUpdate.mockReturnValue({ lean });
    };

    test('atomically claims an expired application', async () => {
      mockClaimQuery({
        _id: applicationId,
        cleanup: { status: 'processing' },
      });

      const result = await claimExpiredApplication(applicationId, now);

      expect(result).not.toBeNull();
      expect(result.application._id).toBe(applicationId);
      expect(result.claimToken).toEqual(expect.any(String));
      expect(result.leaseExpiresAt).toEqual(new Date('2026-10-15T12:15:00Z'));

      expect(JobApplications.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: applicationId,
          $and: expect.any(Array),
        }),
        {
          $set: {
            'cleanup.status': 'processing',
            'cleanup.claimToken': result.claimToken,
            'cleanup.leaseExpiresAt': result.leaseExpiresAt,
            'cleanup.lastError': null,
          },
        },
        { new: true },
      );
    });

    test('returns null when another worker holds the claim', async () => {
      mockClaimQuery(null);

      await expect(claimExpiredApplication(applicationId, now)).resolves.toBeNull();
    });

    test('allows reclaiming an expired lease', async () => {
      mockClaimQuery({ _id: applicationId });

      await claimExpiredApplication(applicationId, now);

      const [filter] = JobApplications.findOneAndUpdate.mock.calls[0];

      expect(filter.$and[1].$or).toContainEqual({
        'cleanup.status': 'processing',
        'cleanup.leaseExpiresAt': { $lt: now },
      });
    });

    test('requires the application to be older than 30 days', async () => {
      mockClaimQuery(null);

      await claimExpiredApplication(applicationId, now);

      const [filter] = JobApplications.findOneAndUpdate.mock.calls[0];

      expect(filter.$and[0].$or).toEqual([
        {
          submittedAt: {
            $lt: new Date('2026-09-15T12:00:00Z'),
          },
        },
        {
          submittedAt: null,
          createdAt: {
            $lt: new Date('2026-09-15T12:00:00Z'),
          },
        },
      ]);
    });

    test('returns a fresh unique token for each successful claim', async () => {
      mockClaimQuery({ _id: applicationId });

      const first = await claimExpiredApplication(applicationId, now);
      const second = await claimExpiredApplication(applicationId, now);

      expect(first.claimToken).not.toBe(second.claimToken);
    });

    test('propagates database failures', async () => {
      const lean = jest.fn().mockRejectedValue(new Error('Database unavailable'));
      JobApplications.findOneAndUpdate.mockReturnValue({ lean });

      await expect(claimExpiredApplication(applicationId, now)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });

  describe('cleanup claim protection', () => {
    const applicationId = '507f1f77bcf86cd799439011';
    const claimToken = 'worker-claim-token';
    const now = new Date('2026-10-15T12:00:00Z');

    test('verifies a valid active claim', async () => {
      const lean = jest.fn().mockResolvedValue({ _id: applicationId });
      const select = jest.fn().mockReturnValue({ lean });
      JobApplications.findOne.mockReturnValue({ select });

      await expect(verifyCleanupClaim(applicationId, claimToken, now)).resolves.toBe(true);

      expect(JobApplications.findOne).toHaveBeenCalledWith({
        _id: applicationId,
        'cleanup.status': 'processing',
        'cleanup.claimToken': claimToken,
        'cleanup.leaseExpiresAt': { $gt: now },
      });
    });

    test('rejects missing, expired, or replaced claims', async () => {
      const lean = jest.fn().mockResolvedValue(null);
      const select = jest.fn().mockReturnValue({ lean });
      JobApplications.findOne.mockReturnValue({ select });

      await expect(verifyCleanupClaim(applicationId, claimToken, now)).resolves.toBe(false);
    });

    test('rejects invalid claim arguments before querying MongoDB', async () => {
      await expect(verifyCleanupClaim(applicationId, '', now)).rejects.toThrow(
        'Valid application ID and claim token are required.',
      );

      expect(JobApplications.findOne).not.toHaveBeenCalled();
    });

    test('releases a claim owned by the current worker', async () => {
      JobApplications.updateOne.mockResolvedValue({ matchedCount: 1 });

      await expect(
        releaseCleanupClaim(applicationId, claimToken, 'Azure unavailable'),
      ).resolves.toBe(true);

      expect(JobApplications.updateOne).toHaveBeenCalledWith(
        {
          _id: applicationId,
          'cleanup.status': 'processing',
          'cleanup.claimToken': claimToken,
        },
        {
          $set: {
            'cleanup.status': 'pending',
            'cleanup.claimToken': null,
            'cleanup.leaseExpiresAt': null,
            'cleanup.lastError': 'Azure unavailable',
          },
        },
      );
    });

    test('does not release another worker claim', async () => {
      JobApplications.updateOne.mockResolvedValue({ matchedCount: 0 });

      await expect(releaseCleanupClaim(applicationId, claimToken)).resolves.toBe(false);
    });

    test('propagates database failures during claim verification', async () => {
      const lean = jest.fn().mockRejectedValue(new Error('Database unavailable'));
      const select = jest.fn().mockReturnValue({ lean });
      JobApplications.findOne.mockReturnValue({ select });

      await expect(verifyCleanupClaim(applicationId, claimToken, now)).rejects.toThrow(
        'Database unavailable',
      );
    });

    test('propagates database failures during claim release', async () => {
      JobApplications.updateOne.mockRejectedValue(new Error('Database unavailable'));

      await expect(releaseCleanupClaim(applicationId, claimToken)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });
});

test('previews expired applications without performing deletion', async () => {
  const origin = 'https://example.blob.core.windows.net';
  const container = 'uploads';
  const now = new Date('2026-10-15T12:00:00Z');

  const applications = [
    {
      _id: 'expired-application',
      submittedAt: new Date('2026-09-01T12:00:00Z'),
      answers: [],
    },
    {
      _id: 'recent-application',
      submittedAt: new Date('2026-10-10T12:00:00Z'),
      answers: [],
    },
    {
      _id: 'invalid-file-application',
      submittedAt: new Date('2026-09-01T12:00:00Z'),
      resumeUrl: 'https://untrusted.example/resumes/file.pdf',
      answers: [],
    },
  ];

  const results = await previewApplicationCleanup(applications, origin, container, now);

  expect(results).toEqual([
    {
      applicationId: 'expired-application',
      eligible: true,
      reason: null,
      blobCount: 0,
    },
    {
      applicationId: 'recent-application',
      eligible: false,
      reason: 'not_expired',
    },
    {
      applicationId: 'invalid-file-application',
      eligible: false,
      reason: 'invalid_file_references',
    },
  ]);

  expect(JobApplications.deleteOne).not.toHaveBeenCalled();
  expect(JobApplications.deleteMany).not.toHaveBeenCalled();
});

test('allows expired applications with valid file references', () => {
  const result = assessApplicationCleanup(
    {
      submittedAt: new Date('2026-09-01T12:00:00Z'),
      answers: [
        {
          answer: {
            type: 'resume',
            url: 'https://example.blob.core.windows.net/uploads/resumes/resume.pdf',
          },
        },
      ],
    },
    'https://example.blob.core.windows.net',
    'uploads',
    new Date('2026-10-15T12:00:00Z'),
  );

  expect(result).toEqual({
    eligible: true,
    reason: null,
    blobNames: ['resumes/resume.pdf'],
  });
});

test('rejects applications that are not yet expired', () => {
  const result = assessApplicationCleanup(
    { submittedAt: new Date('2026-10-01T12:00:00Z') },
    'https://example.blob.core.windows.net',
    'uploads',
    new Date('2026-10-15T12:00:00Z'),
  );

  expect(result).toEqual({
    eligible: false,
    reason: 'not_expired',
    blobNames: [],
  });
});

test('does not expire applications at the exact 30-day boundary', () => {
  const result = assessApplicationCleanup(
    { submittedAt: new Date('2026-09-15T12:00:00Z') },
    'https://example.blob.core.windows.net',
    'uploads',
    new Date('2026-10-15T12:00:00Z'),
  );

  expect(result.eligible).toBe(false);
  expect(result.reason).toBe('not_expired');
});

test('rejects missing dates and invalid file references', () => {
  const origin = 'https://example.blob.core.windows.net';
  const now = new Date('2026-10-15T12:00:00Z');

  expect(assessApplicationCleanup({}, origin, 'uploads', now).reason).toBe(
    'missing_or_invalid_date',
  );

  expect(
    assessApplicationCleanup(
      {
        createdAt: new Date('2026-09-01T12:00:00Z'),
        answers: [
          {
            answer: {
              url: 'https://untrusted.example/resumes/file.pdf',
            },
          },
        ],
      },
      origin,
      'uploads',
      now,
    ).reason,
  ).toBe('invalid_file_references');
});

test('uses createdAt for historical applications without submittedAt', () => {
  const result = assessApplicationCleanup(
    {
      createdAt: new Date('2026-09-01T12:00:00Z'),
      answers: [],
    },
    'https://example.blob.core.windows.net',
    'uploads',
    new Date('2026-10-15T12:00:00Z'),
  );

  expect(result.eligible).toBe(true);
  expect(result.blobNames).toEqual([]);
});

test('collects a legacy resume URL stored outside answers', () => {
  const origin = 'https://example.blob.core.windows.net';
  const container = 'uploads';

  const application = {
    resumeUrl: `${origin}/${container}/resumes/legacy-resume.pdf`,
    answers: [],
  };

  expect(collectApplicationFiles(application, origin, container)).toEqual({
    blobNames: ['resumes/legacy-resume.pdf'],
    invalidReferences: [],
  });
});

test('deduplicates legacy resume URLs and reports invalid ones', () => {
  const origin = 'https://example.blob.core.windows.net';
  const container = 'uploads';
  const resumeUrl = `${origin}/${container}/resumes/resume.pdf`;

  const application = {
    resumeUrl,
    answers: [{ questionId: 'resume', answer: { type: 'resume', url: resumeUrl } }],
  };

  expect(collectApplicationFiles(application, origin, container)).toEqual({
    blobNames: ['resumes/resume.pdf'],
    invalidReferences: [],
  });

  expect(
    collectApplicationFiles(
      { resumeUrl: 'https://unknown.example/resumes/file.pdf', answers: [] },
      origin,
      container,
    ),
  ).toEqual({
    blobNames: [],
    invalidReferences: [{ questionId: null }],
  });
});

test('collects resume and question attachment blobs without duplicates', () => {
  const origin = 'https://example.blob.core.windows.net';
  const container = 'uploads';

  const resumeUrl = `${origin}/${container}/resumes/resume.pdf`;
  const attachmentUrl = `${origin}/${container}/resumes/question.pdf`;

  const application = {
    answers: [
      {
        questionId: 'resume-question',
        answer: { type: 'resume', url: resumeUrl },
      },
      {
        questionId: 'file-question',
        answer: { fileName: 'question.pdf', url: attachmentUrl },
      },
      {
        questionId: 'duplicate-question',
        answer: { url: resumeUrl },
      },
      {
        questionId: 'text-question',
        answer: 'I want to volunteer.',
      },
    ],
  };

  expect(collectApplicationFiles(application, origin, container)).toEqual({
    blobNames: ['resumes/resume.pdf', 'resumes/question.pdf'],
    invalidReferences: [],
  });
});

test('reports invalid file URLs instead of silently skipping them', () => {
  const origin = 'https://example.blob.core.windows.net';
  const container = 'uploads';

  const application = {
    answers: [
      {
        questionId: 'unsafe-file',
        answer: {
          fileName: 'unsafe.pdf',
          url: 'https://unknown.example/resumes/unsafe.pdf',
        },
      },
      {
        questionId: 'missing-file',
        answer: {
          fileName: 'missing.pdf',
        },
      },
    ],
  };

  expect(collectApplicationFiles(application, origin, container)).toEqual({
    blobNames: [],
    invalidReferences: [{ questionId: 'unsafe-file' }],
  });
});

test('handles applications without answers', () => {
  expect(collectApplicationFiles({}, 'https://example.blob.core.windows.net', 'uploads')).toEqual({
    blobNames: [],
    invalidReferences: [],
  });
});
test('uses createdAt only when submittedAt is missing', async () => {
  const cutoff = new Date('2026-09-15T12:00:00Z');

  const lean = jest.fn().mockResolvedValue([]);
  const select = jest.fn().mockReturnValue({ lean });
  JobApplications.find.mockReturnValue({ select });

  await previewExpiredApplications(new Date('2026-10-15T12:00:00Z'));

  expect(JobApplications.find).toHaveBeenCalledWith({
    $or: [
      { submittedAt: { $lt: cutoff } },
      {
        submittedAt: null,
        createdAt: { $lt: cutoff },
      },
    ],
  });

  expect(select).toHaveBeenCalledWith('_id submittedAt createdAt resumeUrl answers');
});

test('detects files referenced by another application', async () => {
  const origin = 'https://example.blob.core.windows.net';
  const container = 'uploads';

  const lean = jest.fn().mockResolvedValue([
    {
      _id: 'another-application',
      resumeUrl: `${origin}/${container}/resumes/shared.pdf`,
      answers: [],
    },
  ]);

  const select = jest.fn().mockReturnValue({ lean });
  JobApplications.find.mockReturnValue({ select });

  const result = await isApplicationFileShared(
    'current-application',
    'resumes/shared.pdf',
    origin,
    container,
  );

  expect(result).toBe(true);
  expect(JobApplications.find).toHaveBeenCalledWith(
    expect.objectContaining({
      _id: { $ne: 'current-application' },
    }),
  );
});

test('allows files that are not referenced by another application', async () => {
  const origin = 'https://example.blob.core.windows.net';
  const container = 'uploads';

  const lean = jest.fn().mockResolvedValue([
    {
      _id: 'another-application',
      resumeUrl: `${origin}/${container}/resumes/different.pdf`,
      answers: [],
    },
  ]);

  const select = jest.fn().mockReturnValue({ lean });
  JobApplications.find.mockReturnValue({ select });

  const result = await isApplicationFileShared(
    'current-application',
    'resumes/current.pdf',
    origin,
    container,
  );

  expect(result).toBe(false);
});

test('treats invalid references in other applications as a conflict', async () => {
  const origin = 'https://example.blob.core.windows.net';
  const container = 'uploads';

  const lean = jest.fn().mockResolvedValue([
    {
      _id: 'another-application',
      resumeUrl: 'https://unknown.example/resumes/file.pdf',
      answers: [],
    },
  ]);

  const select = jest.fn().mockReturnValue({ lean });
  JobApplications.find.mockReturnValue({ select });

  await expect(
    isApplicationFileShared('current-application', 'resumes/current.pdf', origin, container),
  ).resolves.toBe(true);
});

test('propagates database failures instead of assuming a file is unused', async () => {
  const origin = 'https://example.blob.core.windows.net';
  const container = 'uploads';

  const lean = jest.fn().mockRejectedValue(new Error('Database unavailable'));
  const select = jest.fn().mockReturnValue({ lean });
  JobApplications.find.mockReturnValue({ select });

  await expect(
    isApplicationFileShared('current-application', 'resumes/current.pdf', origin, container),
  ).rejects.toThrow('Database unavailable');
});
