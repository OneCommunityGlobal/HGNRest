const mongoose = require('mongoose');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');

const { Schema } = mongoose;

const EmailBatchSchema = new Schema({
  // Batch reference
  batchId: {
    type: Schema.Types.ObjectId,
    ref: 'Email',
    required: [true, 'batchId is required'],
    index: true,
    validate: {
      validator(v) {
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid batchId ObjectId',
    },
  },

  // Multiple recipients in one batch item (emails only)
  recipients: {
    type: [
      {
        _id: false, // Prevent MongoDB from generating _id for each recipient
        email: {
          type: String,
          required: [true, 'Email is required'],
          validate: {
            validator(v) {
              // Basic email format validation
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              return emailRegex.test(v);
            },
            message: 'Invalid email format',
          },
        },
      },
    ],
    required: [true, 'Recipients array is required'],
    validate: {
      validator(v) {
        // Ensure at least one recipient and not too many
        return v && v.length > 0 && v.length <= 1000; // Max 1000 recipients per batch
      },
      message: 'Recipients must have 1-1000 email addresses',
    },
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

  // Processing info
  attempts: {
    type: Number,
    default: 0,
    min: [0, 'Attempts cannot be negative'],
  },
  lastAttemptedAt: {
    type: Date,
    validate: {
      validator(v) {
        return !v || v >= this.createdAt;
      },
      message: 'lastAttemptedAt cannot be before createdAt',
    },
  },
  sentAt: {
    type: Date,
    validate: {
      validator(v) {
        return !v || v >= this.createdAt;
      },
      message: 'sentAt cannot be before createdAt',
    },
  },
  failedAt: {
    type: Date,
    validate: {
      validator(v) {
        return !v || v >= this.createdAt;
      },
      message: 'failedAt cannot be before createdAt',
    },
  },

  // ERROR TRACKING
  lastError: {
    type: String,
    maxlength: [500, 'Error message cannot exceed 500 characters'],
  },
  lastErrorAt: {
    type: Date,
    validate: {
      validator(v) {
        return !v || v >= this.createdAt;
      },
      message: 'lastErrorAt cannot be before createdAt',
    },
  },
  errorCode: {
    type: String,
    maxlength: [1000, 'Error code cannot exceed 1000 characters'],
  },

  // Timestamps
  createdAt: { type: Date, default: () => new Date(), index: true },
  updatedAt: { type: Date, default: () => new Date() },
});

// Update timestamps and validate basic constraints
EmailBatchSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Validate timestamp consistency
  if (this.sentAt && this.failedAt) {
    return next(new Error('Cannot have both sentAt and failedAt'));
  }

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
EmailBatchSchema.index({ batchId: 1, status: 1 }); // For batch queries by status
EmailBatchSchema.index({ status: 1, createdAt: 1 }); // For status-based queries
EmailBatchSchema.index({ batchId: 1, createdAt: -1 }); // For batch history
EmailBatchSchema.index({ lastAttemptedAt: 1 }); // For retry logic
EmailBatchSchema.index({ attempts: 1, status: 1 }); // For retry queries

// Get recipient count for this batch item
EmailBatchSchema.methods.getRecipientCount = function () {
  return this.recipients ? this.recipients.length : 0;
};

// Check if this batch item is in a final state
EmailBatchSchema.methods.isFinalState = function () {
  const { EMAIL_BATCH_STATUSES } = EMAIL_JOB_CONFIG;
  return [EMAIL_BATCH_STATUSES.SENT, EMAIL_BATCH_STATUSES.FAILED].includes(this.status);
};

module.exports = mongoose.model('EmailBatch', EmailBatchSchema, 'emailBatches');
