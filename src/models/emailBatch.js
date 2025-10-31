const mongoose = require('mongoose');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');

/**
 * EmailBatch (child) model representing one SMTP send to a group of recipients.
 * - Tracks recipients, emailType, status, attempt counters and error snapshots.
 */
const { Schema } = mongoose;

const EmailBatchSchema = new Schema({
  // Email reference
  emailId: {
    type: Schema.Types.ObjectId,
    ref: 'Email',
    required: [true, 'emailId is required'],
    index: true,
  },

  // Multiple recipients in one batch item (emails only)
  recipients: {
    type: [
      {
        _id: false, // Prevent MongoDB from generating _id for each recipient
        email: {
          type: String,
          required: [true, 'Email is required'],
        },
      },
    ],
    required: [true, 'Recipients array is required'],
  },

  // Email type for the batch item (uses config enum)
  emailType: {
    type: String,
    enum: Object.values(EMAIL_JOB_CONFIG.EMAIL_TYPES),
    default: EMAIL_JOB_CONFIG.EMAIL_TYPES.BCC, // Use BCC for multiple recipients
    required: [true, 'Email type is required'],
  },

  // Status tracking (for the entire batch item) - uses config enum
  status: {
    type: String,
    enum: Object.values(EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES),
    default: EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.QUEUED,
    index: true,
    required: [true, 'Status is required'],
  },

  attempts: {
    type: Number,
    default: 0,
  },
  lastAttemptedAt: {
    type: Date,
  },
  sentAt: {
    type: Date,
  },
  failedAt: {
    type: Date,
  },

  lastError: {
    type: String,
  },
  lastErrorAt: {
    type: Date,
  },
  errorCode: {
    type: String,
  },

  createdAt: { type: Date, default: () => new Date(), index: true },
  updatedAt: { type: Date, default: () => new Date() },
});

// Update timestamps and validate basic constraints
EmailBatchSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Validate status consistency with timestamps
  if (this.status === EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.SENT && !this.sentAt) {
    this.sentAt = new Date();
  }
  if (this.status === EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.FAILED && !this.failedAt) {
    this.failedAt = new Date();
  }

  next();
});

// Add indexes for better performance
EmailBatchSchema.index({ emailId: 1, status: 1 }); // For batch queries by status
EmailBatchSchema.index({ status: 1, createdAt: 1 }); // For status-based queries
EmailBatchSchema.index({ emailId: 1, createdAt: -1 }); // For batch history
EmailBatchSchema.index({ lastAttemptedAt: 1 }); // For retry logic
EmailBatchSchema.index({ attempts: 1, status: 1 }); // For retry queries

module.exports = mongoose.model('EmailBatch', EmailBatchSchema, 'emailBatches');
