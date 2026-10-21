const mongoose = require('mongoose');
const logger = require('../startup/logger');
const JobApplications = require('../models/jobApplicationsModel');
const { deleteApplicationBlob } = require('../utilities/AzureBlobImages');
const {
  getRetentionCutoff,
  runJobApplicationCleanup,
  claimExpiredApplication,
  verifyCleanupClaim,
  releaseCleanupClaim,
  isApplicationFileShared,
  executeApplicationCleanup,
} = require('../utilities/jobApplicationRetention');

const MAX_BATCHES = 100;
let running = false;

function deletionIsEnabled() {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.JOB_APPLICATION_RETENTION_DELETE_ENABLED === 'true'
  );
}

function getStorageConfig() {
  const expectedOrigin = process.env.JOB_APPLICATION_BLOB_ORIGIN;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!expectedOrigin || !containerName) {
    throw new Error('Job application retention storage configuration is missing.');
  }

  // Validate the origin before using it to identify deletion candidates.
  const parsed = new URL(expectedOrigin);

  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Invalid job application blob origin.');
  }

  if (!/^[a-z0-9-]+$/.test(containerName)) {
    throw new Error('Invalid job application blob container name.');
  }

  return {
    expectedOrigin: parsed.origin,
    containerName,
  };
}

/**
 * Cleanup a single expired application while holding its MongoDB claim.
 * Actual deletion is unavailable unless explicitly enabled in production.
 */
async function cleanupClaimedApplication(applicationId, options = {}) {
  if (!deletionIsEnabled() || options.allowDeletion !== true) {
    return { deleted: false, reason: 'deletion_disabled' };
  }

  if (mongoose.connection.readyState !== 1) {
    return { deleted: false, reason: 'database_not_connected' };
  }

  const storage = getStorageConfig();
  const now = options.now || new Date();
  const claim = await claimExpiredApplication(applicationId, now);

  if (!claim) {
    return { deleted: false, reason: 'claim_unavailable' };
  }

  const { claimToken } = claim;

  async function requireActiveClaim() {
    const active = await verifyCleanupClaim(applicationId, claimToken, new Date());

    if (!active) {
      throw new Error('Cleanup claim expired or belongs to another worker.');
    }
  }

  try {
    const operations = {
      findApplication: async (id) => {
        await requireActiveClaim();

        return JobApplications.findById(id).lean();
      },

      checkSharedFile: async (id, blobName) => {
        await requireActiveClaim();

        return isApplicationFileShared(id, blobName, storage.expectedOrigin, storage.containerName);
      },

      deleteBlob: async (blobName) => {
        // Recheck ownership and references immediately before deletion.
        await requireActiveClaim();

        const shared = await isApplicationFileShared(
          applicationId,
          blobName,
          storage.expectedOrigin,
          storage.containerName,
        );

        if (shared) {
          throw new Error('Uploaded file became shared during cleanup.');
        }

        await requireActiveClaim();
        return deleteApplicationBlob(blobName);
      },

      deleteApplication: async (id) => {
        await requireActiveClaim();

        const cutoff = getRetentionCutoff(new Date());

        // An atomic, claim-bound delete prevents a stale worker from
        // removing a record whose claim has changed or expired.
        const result = await JobApplications.deleteOne({
          _id: id,
          'cleanup.status': 'processing',
          'cleanup.claimToken': claimToken,
          'cleanup.leaseExpiresAt': { $gt: new Date() },
          $or: [
            { submittedAt: { $lt: cutoff } },
            {
              submittedAt: null,
              createdAt: { $lt: cutoff },
            },
          ],
        });

        if (result.deletedCount !== 1) {
          throw new Error('Application deletion was not confirmed.');
        }

        return true;
      },
    };

    const result = await executeApplicationCleanup(applicationId, storage, operations, {
      allowDeletion: true,
      now,
    });

    if (!result.deleted) {
      await releaseCleanupClaim(applicationId, claimToken, result.reason);
    }

    return result;
  } catch (error) {
    try {
      await releaseCleanupClaim(applicationId, claimToken, error.message);
    } catch (releaseError) {
      // Preserve the original failure; the lease can expire for retry.
      throw new Error(
        `Cleanup failed: ${error.message}; claim release failed: ${releaseError.message}`,
      );
    }

    throw error;
  }
}

/**
 * Process bounded batches of expired applications.
 * Individual failures are collected rather than stopping other candidates.
 */
async function runRetentionDeletion() {
  if (!deletionIsEnabled()) {
    return { skipped: true, reason: 'deletion_disabled' };
  }

  if (mongoose.connection.readyState !== 1) {
    return { skipped: true, reason: 'database_not_connected' };
  }

  if (running) {
    return { skipped: true, reason: 'already_running' };
  }

  const storage = getStorageConfig();
  running = true;

  try {
    const now = new Date();
    let cursor = null;
    let batches = 0;
    let deleted = 0;
    let skipped = 0;
    let failed = 0;

    // Bounded pagination ensures a single scheduled run cannot continue forever.
    while (batches < MAX_BATCHES) {
      const preview = await runJobApplicationCleanup(
        storage.expectedOrigin,
        storage.containerName,
        now,
        cursor,
      );

      for (const candidate of preview.results) {
        if (!candidate.eligible) {
          skipped += 1;
          continue;
        }

        try {
          const result = await cleanupClaimedApplication(candidate.applicationId, {
            allowDeletion: true,
            now,
          });

          if (result.deleted) {
            deleted += 1;
          } else {
            skipped += 1;
          }
        } catch (error) {
          failed += 1;

          // Record the failed application so cleanup problems can be investigated.
          logger.logException(
            error,
            `Job application retention cleanup failed for application ${candidate.applicationId}`,
          );
        }
      }

      batches += 1;

      if (!preview.nextCursor || preview.totalApplications === 0) {
        break;
      }

      if (preview.nextCursor === cursor) {
        throw new Error('Retention deletion cursor did not advance.');
      }

      cursor = preview.nextCursor;
    }

    return {
      dryRun: false,
      batches,
      deleted,
      skipped,
      failed,
    };
  } finally {
    running = false;
  }
}

module.exports = {
  deletionIsEnabled,
  cleanupClaimedApplication,
  runRetentionDeletion,
};
