const cron = require('node-cron');
const mongoose = require('mongoose');
const logger = require('../startup/logger');
const { runJobApplicationCleanup } = require('../utilities/jobApplicationRetention');

const SCHEDULE = '0 2 * * *';
const MAX_BATCHES_PER_RUN = 100;

let running = false;
let scheduledTask = null;

/**
 * Preview expired job applications without deleting data or Azure files.
 * A later, separately validated worker will perform actual deletion.
 */
async function runRetentionPreview() {
  if (running) {
    return { skipped: true, reason: 'already_running' };
  }

  if (mongoose.connection.readyState !== 1) {
    return { skipped: true, reason: 'database_not_connected' };
  }

  const expectedOrigin = process.env.JOB_APPLICATION_BLOB_ORIGIN;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!expectedOrigin || !containerName) {
    return { skipped: true, reason: 'storage_configuration_missing' };
  }

  running = true;

  try {
    const now = new Date();
    let cursor = null;
    let batches = 0;
    let inspected = 0;
    let eligible = 0;
    let skipped = 0;

    while (batches < MAX_BATCHES_PER_RUN) {
      const result = await runJobApplicationCleanup(expectedOrigin, containerName, now, cursor);

      inspected += result.totalApplications;
      eligible += result.eligibleCount;
      skipped += result.skippedCount;
      batches += 1;

      if (!result.nextCursor || result.totalApplications === 0) {
        break;
      }

      // Prevent a broken pagination cursor from looping forever.
      if (result.nextCursor === cursor) {
        throw new Error('Retention preview cursor did not advance.');
      }

      cursor = result.nextCursor;
    }

    logger.logInfo(
      `Job application retention preview: inspected=${inspected}, eligible=${eligible}, skipped=${skipped}, batches=${batches}, dryRun=true`,
    );

    return {
      dryRun: true,
      inspected,
      eligible,
      skipped,
      batches,
    };
  } finally {
    running = false;
  }
}

/**
 * Registration is explicitly opt-in and never enables deletion.
 */

function startJobApplicationRetentionJob() {
  const previewEnabled = process.env.JOB_APPLICATION_RETENTION_PREVIEW_ENABLED === 'true';

  const deletionEnabled =
    process.env.NODE_ENV === 'production' &&
    process.env.JOB_APPLICATION_RETENTION_DELETE_ENABLED === 'true';

  if (!previewEnabled && !deletionEnabled) {
    return null;
  }

  if (scheduledTask) {
    return scheduledTask;
  }

  scheduledTask = cron.schedule(
    SCHEDULE,
    async () => {
      try {
        if (deletionEnabled) {
          // Load the destructive worker only inside the explicitly gated path.
          const { runRetentionDeletion } = require('./jobApplicationRetentionWorker');

          const result = await runRetentionDeletion();

          logger.logInfo(`Job application retention deletion: ${JSON.stringify(result)}`);
        } else {
          await runRetentionPreview();
        }
      } catch (error) {
        logger.logException(error, 'Job application retention job failed');
      }
    },
    { timezone: 'Etc/UTC' },
  );

  return scheduledTask;
}

module.exports = {
  runRetentionPreview,
  startJobApplicationRetentionJob,
};
