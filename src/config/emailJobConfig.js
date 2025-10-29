/**
 * Email Job Queue Configuration
 * Centralized configuration for email announcement job queue system
 */

const EMAIL_JOB_CONFIG = {
  // Processing intervals
  CRON_INTERVAL: '0 * * * * *', // Every minute at 0 seconds
  MAX_CONCURRENT_BATCHES: 3,

  // Retry configuration
  DEFAULT_MAX_RETRIES: 3,
  RETRY_DELAYS: [60000, 300000, 900000], // 1min, 5min, 15min

  // Status enums
  EMAIL_STATUSES: {
    QUEUED: 'QUEUED', // Waiting in queue
    SENDING: 'SENDING', // Currently sending
    SENT: 'SENT', // All emails successfully sent
    PROCESSED: 'PROCESSED', // Processing finished (mixed results)
    FAILED: 'FAILED', // Failed to send
    CANCELLED: 'CANCELLED', // Cancelled by user
  },

  EMAIL_BATCH_STATUSES: {
    QUEUED: 'QUEUED', // Waiting to send
    SENDING: 'SENDING', // Currently sending
    SENT: 'SENT', // Successfully delivered
    FAILED: 'FAILED', // Delivery failed
    RESENDING: 'RESENDING', // Resending delivery
  },

  EMAIL_BATCH_AUDIT_ACTIONS: {
    // Email-level actions (main batch)
    EMAIL_CREATED: 'EMAIL_CREATED',
    EMAIL_QUEUED: 'EMAIL_QUEUED',
    EMAIL_SENDING: 'EMAIL_SENDING',
    EMAIL_SENT: 'EMAIL_SENT',
    EMAIL_PROCESSED: 'EMAIL_PROCESSED',
    EMAIL_FAILED: 'EMAIL_FAILED',
    EMAIL_CANCELLED: 'EMAIL_CANCELLED',

    // Email batch item-level actions
    EMAIL_BATCH_QUEUED: 'EMAIL_BATCH_QUEUED',
    EMAIL_BATCH_SENDING: 'EMAIL_BATCH_SENDING',
    EMAIL_BATCH_SENT: 'EMAIL_BATCH_SENT',
    EMAIL_BATCH_FAILED: 'EMAIL_BATCH_FAILED',
    EMAIL_BATCH_RESENDING: 'EMAIL_BATCH_RESENDING',
  },

  EMAIL_TYPES: {
    TO: 'TO',
    CC: 'CC',
    BCC: 'BCC',
  },
};

module.exports = { EMAIL_JOB_CONFIG };
