/**
 * Simplified Email Batch Item Model - Production Ready
 * Focus: Store multiple recipients per batch item, no names or priority
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const EmailBatchItemSchema = new Schema({
  // Batch reference
  batchId: { type: Schema.Types.ObjectId, ref: 'EmailBatch', required: true, index: true },

  // Multiple recipients in one batch item (emails only)
  // _id: false prevents MongoDB from generating unnecessary _id fields for each recipient
  recipients: [
    {
      _id: false, // Prevent MongoDB from generating _id for each recipient
      email: { type: String, required: true },
    },
  ],

  // Email type for the batch item
  emailType: {
    type: String,
    enum: ['TO', 'CC', 'BCC'],
    default: 'BCC', // Use BCC for multiple recipients
  },

  // Status tracking (for the entire batch item)
  status: {
    type: String,
    enum: ['PENDING', 'SENDING', 'SENT', 'FAILED'],
    default: 'PENDING',
    index: true,
  },

  // Processing info
  attempts: { type: Number, default: 0 },
  lastAttemptedAt: Date,
  sentAt: Date,
  failedAt: Date,
  error: String,

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update timestamps
EmailBatchItemSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Update status with proper attempt tracking
EmailBatchItemSchema.methods.updateStatus = async function (newStatus, errorMessage = null) {
  this.status = newStatus;
  this.lastAttemptedAt = new Date();

  // Only increment attempts for actual sending attempts (SENDING status)
  if (newStatus === 'SENDING') {
    this.attempts += 1;
  }

  if (newStatus === 'SENT') {
    this.sentAt = new Date();
    this.failedAt = null;
    this.error = null;
  } else if (newStatus === 'FAILED') {
    this.failedAt = new Date();
    this.error = errorMessage;
  }

  await this.save();

  // Update parent batch status
  const EmailBatch = require('./emailBatch');
  const batch = await EmailBatch.findById(this.batchId);
  if (batch) {
    await batch.updateStatus();
  }

  return this;
};

module.exports = mongoose.model('EmailBatchItem', EmailBatchItemSchema, 'emailBatchItems');
