/**
 * Simplified Email Batch Model - Production Ready
 * Focus: Store batch information with email body for efficiency
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const EmailBatchSchema = new Schema({
  // Core identification
  batchId: { type: String, required: true, unique: true, index: true },
  subject: { type: String, required: true },
  htmlContent: { type: String, required: true }, // Store email body in batch

  // Status tracking
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
    index: true,
  },

  // Creator reference only
  createdBy: { type: Schema.Types.ObjectId, ref: 'userProfile', required: true },

  // Timing
  createdAt: { type: Date, default: Date.now, index: true },
  startedAt: Date,
  completedAt: Date,
  updatedAt: { type: Date, default: Date.now },
});

// Update timestamps
EmailBatchSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Calculate email counts dynamically from batch items with multiple recipients
EmailBatchSchema.methods.getEmailCounts = async function () {
  const EmailBatchItem = require('./emailBatchItem');

  const counts = await EmailBatchItem.aggregate([
    { $match: { batchId: this._id } },
    {
      $group: {
        _id: null,
        total: { $sum: { $cond: [{ $isArray: '$recipients' }, { $size: '$recipients' }, 0] } },
        sent: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'SENT'] }, { $isArray: '$recipients' }] },
              { $size: '$recipients' },
              0,
            ],
          },
        },
        failed: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'FAILED'] }, { $isArray: '$recipients' }] },
              { $size: '$recipients' },
              0,
            ],
          },
        },
        pending: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$status', ['PENDING', 'SENDING']] }, { $isArray: '$recipients' }] },
              { $size: '$recipients' },
              0,
            ],
          },
        },
      },
    },
  ]);

  if (counts.length > 0) {
    const count = counts[0];
    return {
      totalEmails: count.total || 0,
      sentEmails: count.sent || 0,
      failedEmails: count.failed || 0,
      pendingEmails: count.pending || 0,
      progress: count.total > 0 ? Math.round((count.sent / count.total) * 100) : 0,
    };
  }

  return {
    totalEmails: 0,
    sentEmails: 0,
    failedEmails: 0,
    pendingEmails: 0,
    progress: 0,
  };
};

// Update status based on email counts
EmailBatchSchema.methods.updateStatus = async function () {
  const counts = await this.getEmailCounts();

  if (counts.pendingEmails === 0 && counts.totalEmails > 0) {
    // All emails processed
    if (counts.failedEmails === 0) {
      this.status = 'COMPLETED';
    } else if (counts.sentEmails === 0) {
      this.status = 'FAILED';
    } else {
      this.status = 'COMPLETED'; // Partial success
    }
    this.completedAt = new Date();
  } else if (counts.totalEmails > 0) {
    this.status = 'PROCESSING';
    if (!this.startedAt) {
      this.startedAt = new Date();
    }
  }

  await this.save();
  return this;
};

module.exports = mongoose.model('EmailBatch', EmailBatchSchema, 'emailBatches');
