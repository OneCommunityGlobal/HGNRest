const mongoose = require('mongoose');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');

/**
 * EmailBatchAudit model for immutable audit trail of email/batch actions.
 * - Captures action, details, optional error info, metadata, and actor.
 */
const { Schema } = mongoose;

const EmailBatchAuditSchema = new Schema({
  // Reference to the main email
  emailId: {
    type: Schema.Types.ObjectId,
    ref: 'Email',
    required: [true, 'emailId is required'],
    index: true,
  },

  // Reference to specific email batch item
  emailBatchId: {
    type: Schema.Types.ObjectId,
    ref: 'EmailBatch',
    index: true,
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
  },

  // Error information (if applicable)
  error: {
    type: String,
  },
  errorCode: {
    type: String,
  },

  // Contextual metadata (flexible object for additional data)
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
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
