/**
 * Email Job Queue Configuration
 * Centralized configuration for email announcement job queue system
 */

const EMAIL_JOB_CONFIG = {
  // Processing intervals
  CRON_INTERVAL: '0 * * * * *', // Every minute at 0 seconds
  TIMEZONE: 'UTC', // Cron timezone; adjust as needed (e.g., 'America/Los_Angeles')
  MAX_CONCURRENT_BATCHES: 3,

  // Retry configuration
  DEFAULT_MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 1000,

  // Status enums
  EMAIL_STATUSES: {
    QUEUED: 'QUEUED', // Waiting in queue
    SENDING: 'SENDING', // Currently sending
    SENT: 'SENT', // All emails successfully sent
    PROCESSED: 'PROCESSED', // Processing finished (mixed results)
    FAILED: 'FAILED', // Failed to send
  },

  EMAIL_BATCH_STATUSES: {
    QUEUED: 'QUEUED', // Waiting to send
    SENDING: 'SENDING', // Currently sending
    SENT: 'SENT', // Successfully delivered
    FAILED: 'FAILED', // Delivery failed
  },

  EMAIL_BATCH_AUDIT_ACTIONS: {
    // Email-level actions (main batch)
    EMAIL_QUEUED: 'EMAIL_QUEUED',
    EMAIL_SENDING: 'EMAIL_SENDING',
    EMAIL_SENT: 'EMAIL_SENT',
    EMAIL_PROCESSED: 'EMAIL_PROCESSED',
    EMAIL_FAILED: 'EMAIL_FAILED',

    // Email batch item-level actions
    EMAIL_BATCH_QUEUED: 'EMAIL_BATCH_QUEUED',
    EMAIL_BATCH_SENDING: 'EMAIL_BATCH_SENDING',
    EMAIL_BATCH_SENT: 'EMAIL_BATCH_SENT',
    EMAIL_BATCH_FAILED: 'EMAIL_BATCH_FAILED',
  },

  EMAIL_TYPES: {
    TO: 'TO',
    CC: 'CC',
    BCC: 'BCC',
  },

  // Centralized limits to keep model, services, and controllers consistent
  LIMITS: {
    MAX_RECIPIENTS_PER_REQUEST: 1000, // Must match EmailBatch.recipients validator
    MAX_HTML_BYTES: 1 * 1024 * 1024, // 1MB - Reduced since base64 media files are blocked
    SUBJECT_MAX_LENGTH: 200, // Standardized subject length limit
  },

  // Announcement service runtime knobs
  ANNOUNCEMENTS: {
    BATCH_SIZE: 50, // recipients per SMTP send batch
    CONCURRENCY: 3, // concurrent SMTP batches
    RATE_LIMIT_DELAY_MS: 1000, // delay between queue cycles when more remain
  },
};

module.exports = { EMAIL_JOB_CONFIG };
