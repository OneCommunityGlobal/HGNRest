const mongoose = require('mongoose');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');

const { Schema } = mongoose;

const EmailBatchAuditSchema = new Schema({
  // Reference to the main email
  emailId: {
    type: Schema.Types.ObjectId,
    ref: 'Email',
    required: [true, 'emailId is required'],
    index: true,
    validate: {
      validator(v) {
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid emailId ObjectId',
    },
  },

  // Reference to specific email batch item
  emailBatchId: {
    type: Schema.Types.ObjectId,
    ref: 'EmailBatch',
    index: true,
    validate: {
      validator(v) {
        return !v || mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid emailBatchId ObjectId',
    },
  },

  // Action performed (uses config enum)
  action: {
    type: String,
    enum: Object.values(EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS),
    required: [true, 'Action is required'],
    index: true,
  },

  // Action details
  details: {
    type: String,
    required: [true, 'Details are required'],
    maxlength: [1000, 'Details cannot exceed 1000 characters'],
    validate: {
      validator(v) {
        return v && v.trim().length > 0;
      },
      message: 'Details cannot be empty or whitespace only',
    },
  },

  // Error information (if applicable)
  error: {
    type: String,
    maxlength: [1000, 'Error message cannot exceed 1000 characters'],
  },
  errorCode: {
    type: String,
    maxlength: [50, 'Error code cannot exceed 50 characters'],
  },

  // Contextual metadata (flexible object for additional data)
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
    validate: {
      validator(v) {
        // Limit metadata size to prevent abuse
        const sizeInBytes = Buffer.byteLength(JSON.stringify(v), 'utf8');
        return sizeInBytes <= 10000; // 10KB limit
      },
      message: 'Metadata cannot exceed 10KB',
    },
  },

  // Timestamps
  timestamp: {
    type: Date,
    default: () => new Date(),
    index: true,
    required: [true, 'Timestamp is required'],
  },

  // User who triggered the action (if applicable)
  triggeredBy: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    validate: {
      validator(v) {
        return !v || mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid triggeredBy ObjectId',
    },
  },

  // Processing context
  processingContext: {
    attemptNumber: {
      type: Number,
      min: [0, 'Attempt number cannot be negative'],
    },
    retryDelay: {
      type: Number,
      min: [0, 'Retry delay cannot be negative'],
    },
    processingTime: {
      type: Number,
      min: [0, 'Processing time cannot be negative'],
    },
  },
});

// Indexes for efficient querying
EmailBatchAuditSchema.index({ emailId: 1, timestamp: 1 });
EmailBatchAuditSchema.index({ emailBatchId: 1, timestamp: 1 });
EmailBatchAuditSchema.index({ action: 1, timestamp: 1 });
EmailBatchAuditSchema.index({ timestamp: -1 });
EmailBatchAuditSchema.index({ triggeredBy: 1, timestamp: -1 }); // For user audit queries
EmailBatchAuditSchema.index({ emailId: 1, action: 1 }); // For action-specific queries

module.exports = mongoose.model('EmailBatchAudit', EmailBatchAuditSchema, 'emailBatchAudits');
