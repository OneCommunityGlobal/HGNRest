const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const JobApplications = require('../models/jobApplicationsModel');
const { getApplicationBlobName } = require('./jobApplicationBlobValidator');

const RETENTION_DAYS = 30;
const CLEANUP_BATCH_SIZE = 100;
const CLEANUP_LEASE_MINUTES = 15;

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;

const MS_PER_MINUTE = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * MS_PER_MINUTE;

/**
 * Return the cutoff date for expired job applications.
 * Records submitted before this date are eligible for cleanup.
 */
const getRetentionCutoff = (now = new Date()) => {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('A valid date is required.');
  }

  return new Date(now.getTime() - RETENTION_DAYS * MS_PER_DAY);
};

/**
 * Read-only preview of expired applications.
 * Does not delete records or uploaded files.
 */
const previewExpiredApplications = async (now = new Date()) => {
  const cutoff = getRetentionCutoff(now);

  const applications = await JobApplications.find({
    $or: [
      // Use the submission date whenever it exists.
      { submittedAt: { $lt: cutoff } },

      // Historical records may predate the submittedAt field.
      // Fall back only when submittedAt is missing or null.
      {
        submittedAt: null,
        createdAt: { $lt: cutoff },
      },
    ],
  })
    .select('_id submittedAt createdAt resumeUrl answers')
    .lean();

  return {
    cutoff,
    totalApplications: applications.length,
    applicationIds: applications.map((application) => String(application._id)),
  };
};

/**
 * Identify application-upload blobs without deleting anything.
 * Report invalid references so cleanup cannot silently skip them.
 */
const collectApplicationFiles = (application, expectedOrigin, containerName) => {
  const blobNames = new Set();
  const invalidReferences = [];

  // Older applications may store the resume URL separately from answers.
  if (application?.resumeUrl) {
    const resumeBlobName = getApplicationBlobName(
      application.resumeUrl,
      expectedOrigin,
      containerName,
    );

    if (resumeBlobName) {
      blobNames.add(resumeBlobName);
    } else {
      invalidReferences.push({ questionId: null });
    }
  }

  const answers = Array.isArray(application?.answers) ? application.answers : [];

  answers.forEach((entry) => {
    const answer = entry?.answer;

    // Ignore answers that do not contain an uploaded-file URL.
    if (
      answer &&
      typeof answer === 'object' &&
      !Array.isArray(answer) &&
      Object.prototype.hasOwnProperty.call(answer, 'url')
    ) {
      const blobName = getApplicationBlobName(answer.url, expectedOrigin, containerName);

      if (blobName) {
        blobNames.add(blobName);
      } else {
        // Keep invalid references visible to future cleanup logic.
        invalidReferences.push({
          questionId: entry?.questionId ? String(entry.questionId) : null,
        });
      }
    }
  });

  return {
    blobNames: [...blobNames],
    invalidReferences,
  };
};

/**
 * Check whether an application is safe to process for cleanup.
 * This function does not access MongoDB or Azure.
 */
const assessApplicationCleanup = (application, expectedOrigin, containerName, now = new Date()) => {
  const cutoff = getRetentionCutoff(now);

  // Use submittedAt when present; otherwise use historical createdAt.
  const applicationDate = application?.submittedAt ?? application?.createdAt;

  if (!applicationDate || Number.isNaN(new Date(applicationDate).getTime())) {
    return {
      eligible: false,
      reason: 'missing_or_invalid_date',
      blobNames: [],
    };
  }

  if (new Date(applicationDate) >= cutoff) {
    return {
      eligible: false,
      reason: 'not_expired',
      blobNames: [],
    };
  }

  const { blobNames, invalidReferences } = collectApplicationFiles(
    application,
    expectedOrigin,
    containerName,
  );

  if (invalidReferences.length > 0) {
    return {
      eligible: false,
      reason: 'invalid_file_references',
      blobNames: [],
    };
  }

  return {
    eligible: true,
    reason: null,
    blobNames,
  };
};

/**
 * Check whether another application references a candidate blob.
 * Only read-only MongoDB queries are performed.
 *
 * A query failure must stop cleanup rather than assume the file is unused.
 */
const isApplicationFileShared = async (applicationId, blobName, expectedOrigin, containerName) => {
  if (!applicationId || typeof blobName !== 'string') {
    throw new Error('Application ID and blob name are required.');
  }

  const validBlobName = getApplicationBlobName(
    `${expectedOrigin}/${containerName}/${blobName}`,
    expectedOrigin,
    containerName,
  );

  if (validBlobName !== blobName) {
    throw new Error('Invalid application blob name.');
  }

  const otherApplications = await JobApplications.find({
    _id: { $ne: applicationId },
    $or: [{ resumeUrl: { $exists: true, $ne: '' } }, { 'answers.answer.url': { $exists: true } }],
  })
    .select('_id resumeUrl answers')
    .lean();

  return otherApplications.some((application) => {
    const { blobNames, invalidReferences } = collectApplicationFiles(
      application,
      expectedOrigin,
      containerName,
    );

    // Invalid references must not be assumed safe to delete.
    return invalidReferences.length > 0 || blobNames.includes(blobName);
  });
};

/**
 * Preview cleanup decisions without deleting records or Azure blobs.
 * Shared-file checks run concurrently.
 * Any database failure rejects the preview.
 */
const previewApplicationCleanup = async (
  applications,
  expectedOrigin,
  containerName,
  now = new Date(),
) =>
  Promise.all(
    applications.map(async (application) => {
      const assessment = assessApplicationCleanup(application, expectedOrigin, containerName, now);

      if (!assessment.eligible) {
        return {
          applicationId: String(application._id),
          eligible: false,
          reason: assessment.reason,
        };
      }

      const sharedResults = await Promise.all(
        assessment.blobNames.map((blobName) =>
          isApplicationFileShared(application._id, blobName, expectedOrigin, containerName),
        ),
      );

      const shared = sharedResults.some(Boolean);

      return {
        applicationId: String(application._id),
        eligible: !shared,
        reason: shared ? 'shared_file_reference' : null,
        blobCount: assessment.blobNames.length,
      };
    }),
  );

/**
 * Preview one batch of expired applications.
 * Use nextCursor to continue with the following batch.
 * This function never deletes records or Azure blobs.
 */
const runJobApplicationCleanup = async (
  expectedOrigin,
  containerName,
  now = new Date(),
  cursor = null,
) => {
  const cutoff = getRetentionCutoff(now);

  if (cursor !== null && (typeof cursor !== 'string' || !/^[a-fA-F0-9]{24}$/.test(cursor))) {
    throw new Error('Invalid cleanup cursor.');
  }

  const query = {
    $or: [
      { submittedAt: { $lt: cutoff } },
      {
        submittedAt: null,
        createdAt: { $lt: cutoff },
      },
    ],
  };

  if (cursor) {
    // Compare MongoDB ObjectIds rather than string values.
    query._id = { $gt: new mongoose.Types.ObjectId(cursor) };
  }

  const applications = await JobApplications.find(query)
    .sort({ _id: 1 })
    .limit(CLEANUP_BATCH_SIZE)
    .select('_id submittedAt createdAt resumeUrl answers')
    .lean();

  const results = await previewApplicationCleanup(applications, expectedOrigin, containerName, now);

  const lastApplication = applications[applications.length - 1];

  return {
    dryRun: true,
    cutoff,
    totalApplications: results.length,
    eligibleCount: results.filter((result) => result.eligible).length,
    skippedCount: results.filter((result) => !result.eligible).length,
    nextCursor: lastApplication ? String(lastApplication._id) : null,
    results,
  };
};

/**
 * Execute cleanup for one application using explicitly supplied operations.
 *
 * This function is not connected to production deletion or a scheduler.
 * Destructive behavior is disabled unless explicitly enabled.
 */
const executeApplicationCleanup = async (
  applicationId,
  { expectedOrigin, containerName },
  operations = {},
  options = {},
) => {
  if (options.allowDeletion !== true) {
    return {
      deleted: false,
      reason: 'deletion_disabled',
    };
  }

  const { findApplication, checkSharedFile, deleteBlob, deleteApplication } = operations;

  if (
    !applicationId ||
    typeof findApplication !== 'function' ||
    typeof checkSharedFile !== 'function' ||
    typeof deleteBlob !== 'function' ||
    typeof deleteApplication !== 'function'
  ) {
    throw new Error('Cleanup requires valid application ID and operations.');
  }

  // Fetch fresh application data before assessing deletion eligibility.
  const application = await findApplication(applicationId);

  if (!application) {
    return {
      deleted: false,
      reason: 'application_not_found',
    };
  }

  const assessment = assessApplicationCleanup(
    application,
    expectedOrigin,
    containerName,
    options.now || new Date(),
  );

  if (!assessment.eligible) {
    return {
      deleted: false,
      reason: assessment.reason,
    };
  }

  // Verify every candidate file before performing any deletion.
  const sharedResults = await Promise.all(
    assessment.blobNames.map((blobName) => checkSharedFile(applicationId, blobName)),
  );

  if (sharedResults.some(Boolean)) {
    return {
      deleted: false,
      reason: 'shared_file_reference',
    };
  }

  // Files must be handled before removing their database references.
  // Errors propagate so the application record remains available for retry.
  await Promise.all(assessment.blobNames.map((blobName) => deleteBlob(blobName)));

  await deleteApplication(applicationId);

  return {
    deleted: true,
    reason: null,
    deletedBlobCount: assessment.blobNames.length,
  };
};

/**
 * Atomically claim an expired application for one cleanup worker.
 * This function does not delete applications or Azure files.
 */
const claimExpiredApplication = async (applicationId, now = new Date()) => {
  const cutoff = getRetentionCutoff(now);
  const claimToken = randomUUID();

  const leaseExpiresAt = new Date(now.getTime() + CLEANUP_LEASE_MINUTES * MS_PER_MINUTE);

  const claimedApplication = await JobApplications.findOneAndUpdate(
    {
      _id: applicationId,
      $and: [
        {
          $or: [
            { submittedAt: { $lt: cutoff } },
            {
              submittedAt: null,
              createdAt: { $lt: cutoff },
            },
          ],
        },
        {
          $or: [
            { 'cleanup.status': 'pending' },
            { 'cleanup.status': { $exists: false } },
            {
              'cleanup.status': 'processing',
              'cleanup.leaseExpiresAt': { $lt: now },
            },
          ],
        },
      ],
    },
    {
      $set: {
        'cleanup.status': 'processing',
        'cleanup.claimToken': claimToken,
        'cleanup.leaseExpiresAt': leaseExpiresAt,
        'cleanup.lastError': null,
      },
    },
    { new: true },
  ).lean();

  if (!claimedApplication) {
    return null;
  }

  return {
    application: claimedApplication,
    claimToken,
    leaseExpiresAt,
  };
};

/**
 * Verify that the worker still owns an unexpired cleanup claim.
 * This is a read-only database check.
 */
const verifyCleanupClaim = async (applicationId, claimToken, now = new Date()) => {
  if (!applicationId || typeof claimToken !== 'string' || !claimToken.trim()) {
    throw new Error('Valid application ID and claim token are required.');
  }

  getRetentionCutoff(now);

  const application = await JobApplications.findOne({
    _id: applicationId,
    'cleanup.status': 'processing',
    'cleanup.claimToken': claimToken,
    'cleanup.leaseExpiresAt': { $gt: now },
  })
    .select('_id cleanup')
    .lean();

  return Boolean(application);
};

/**
 * Release a worker's cleanup claim after a failure.
 * A worker cannot release a claim that belongs to another worker.
 */
const releaseCleanupClaim = async (applicationId, claimToken, errorMessage = null) => {
  if (!applicationId || typeof claimToken !== 'string' || !claimToken.trim()) {
    throw new Error('Valid application ID and claim token are required.');
  }

  const result = await JobApplications.updateOne(
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
        'cleanup.lastError': errorMessage ? String(errorMessage).slice(0, 500) : null,
      },
    },
  );

  return result.matchedCount === 1;
};

module.exports = {
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
};
