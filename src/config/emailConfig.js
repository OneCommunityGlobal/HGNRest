/**
 * Email Configuration
 * Centralized configuration for email announcement system
 */

const EMAIL_CONFIG = {
  // Retry configuration
  DEFAULT_MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 1000,

  // Status enums
  EMAIL_STATUSES: {
    PENDING: 'PENDING', // Created, waiting to be processed
    SENDING: 'SENDING', // Currently sending
    SENT: 'SENT', // All emails successfully accepted by SMTP server
    PROCESSED: 'PROCESSED', // Processing finished (mixed results)
    FAILED: 'FAILED', // Failed to send
  },

  EMAIL_BATCH_STATUSES: {
    PENDING: 'PENDING', // Created, waiting to be processed
    SENDING: 'SENDING', // Currently sending
    SENT: 'SENT', // Successfully delivered
    FAILED: 'FAILED', // Delivery failed
  },

  EMAIL_TYPES: {
    TO: 'TO',
    CC: 'CC',
    BCC: 'BCC',
  },

  // Centralized limits to keep model, services, and controllers consistent
  LIMITS: {
    MAX_RECIPIENTS_PER_REQUEST: 2000, // Must match EmailBatch.recipients validator
    MAX_HTML_BYTES: 1 * 1024 * 1024, // 1MB - Reduced since base64 media files are blocked
    SUBJECT_MAX_LENGTH: 200, // Standardized subject length limit
    TEMPLATE_NAME_MAX_LENGTH: 50, // Template name maximum length
  },

  // Template variable types
  TEMPLATE_VARIABLE_TYPES: ['text', 'number', 'image', 'url', 'textarea'],

  // Announcement service runtime knobs
  ANNOUNCEMENTS: {
    BATCH_SIZE: 100, // recipients per SMTP send batch
    CONCURRENCY: 3, // concurrent SMTP batches processed simultaneously
    BATCH_STAGGER_START_MS: 100, // Delay between starting batches within a concurrent chunk (staggered start for rate limiting)
    DELAY_BETWEEN_CHUNKS_MS: 1000, // Delay after a chunk of batches completes before starting the next chunk
    MAX_QUEUE_SIZE: 100, // Maximum emails in processing queue to prevent memory leak
  },

  // Email configuration
  EMAIL: {
    SENDER: process.env.ANNOUNCEMENT_EMAIL,
    SENDER_NAME: process.env.ANNOUNCEMENT_EMAIL_SENDER_NAME,
  },
};

module.exports = { EMAIL_CONFIG };
