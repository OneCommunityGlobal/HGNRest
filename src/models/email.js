const mongoose = require('mongoose');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');

const { Schema } = mongoose;

const EmailSchema = new Schema({
  batchId: {
    type: String,
    required: [true, 'batchId is required'],
    unique: true,
    index: true,
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    maxlength: [200, 'Subject cannot exceed 200 characters'],
    validate: {
      validator(v) {
        return v && v.trim().length > 0;
      },
      message: 'Subject cannot be empty or whitespace only',
    },
  },
  htmlContent: {
    type: String,
    required: [true, 'HTML content is required'],
    validate: {
      validator(v) {
        return v && v.trim().length > 0;
      },
      message: 'HTML content cannot be empty or whitespace only',
    },
  },
  status: {
    type: String,
    enum: Object.values(EMAIL_JOB_CONFIG.EMAIL_STATUSES),
    default: EMAIL_JOB_CONFIG.EMAIL_STATUSES.QUEUED,
    index: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: [true, 'createdBy is required'],
    validate: {
      validator(v) {
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid createdBy ObjectId',
    },
  },
  createdAt: { type: Date, default: () => new Date(), index: true },
  startedAt: {
    type: Date,
    validate: {
      validator(v) {
        return !v || v >= this.createdAt;
      },
      message: 'startedAt cannot be before createdAt',
    },
  },
  completedAt: {
    type: Date,
    validate: {
      validator(v) {
        return !v || v >= (this.startedAt || this.createdAt);
      },
      message: 'completedAt cannot be before startedAt or createdAt',
    },
  },
  updatedAt: { type: Date, default: () => new Date() },
  lastStuckFixAttempt: { type: Date }, // For preventing infinite retries
});

// Update timestamps and validate basic constraints
EmailSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Validate timestamp consistency
  if (this.startedAt && this.completedAt && this.startedAt > this.completedAt) {
    return next(new Error('startedAt cannot be after completedAt'));
  }

  next();
});

// Add indexes for better performance
EmailSchema.index({ status: 1, createdAt: 1 });
EmailSchema.index({ createdBy: 1, createdAt: -1 });
EmailSchema.index({ startedAt: 1 });
EmailSchema.index({ completedAt: 1 });

// Calculate email counts dynamically from batch items with multiple recipients
EmailSchema.methods.getEmailCounts = async function () {
  try {
    const EmailBatch = require('./emailBatch');

    // Validate this._id exists
    if (!this._id) {
      throw new Error('Email ID is required for counting');
    }

    const counts = await EmailBatch.aggregate([
      { $match: { batchId: this._id } }, // EmailBatch.batchId references Email._id (ObjectId)
      {
        $group: {
          _id: null,
          total: { $sum: { $cond: [{ $isArray: '$recipients' }, { $size: '$recipients' }, 0] } },
          sent: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.SENT] },
                    { $isArray: '$recipients' },
                  ],
                },
                { $size: '$recipients' },
                0,
              ],
            },
          },
          failed: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.FAILED] },
                    { $isArray: '$recipients' },
                  ],
                },
                { $size: '$recipients' },
                0,
              ],
            },
          },
          pending: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        '$status',
                        [
                          EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.QUEUED,
                          EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.SENDING,
                          EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.RESENDING,
                        ],
                      ],
                    },
                    { $isArray: '$recipients' },
                  ],
                },
                { $size: '$recipients' },
                0,
              ],
            },
          },
          cancelled: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.CANCELLED] },
                    { $isArray: '$recipients' },
                  ],
                },
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

      // Protect against negative counts (data corruption edge case)
      const totalEmails = Math.max(0, count.total || 0);
      const sentEmails = Math.max(0, Math.min(count.sent || 0, totalEmails));
      const failedEmails = Math.max(0, Math.min(count.failed || 0, totalEmails));
      const pendingEmails = Math.max(0, Math.min(count.pending || 0, totalEmails));
      const cancelledEmails = Math.max(0, Math.min(count.cancelled || 0, totalEmails));

      // Validate counts don't exceed total
      const calculatedTotal = sentEmails + failedEmails + pendingEmails + cancelledEmails;
      if (calculatedTotal !== totalEmails) {
        console.warn(
          `Email count mismatch for ${this._id}: calculated=${calculatedTotal}, total=${totalEmails}`,
        );
      }

      return {
        totalEmails,
        sentEmails,
        failedEmails,
        pendingEmails,
        cancelledEmails,
        progress: totalEmails > 0 ? Math.round((sentEmails / totalEmails) * 100) : 0,
      };
    }

    return {
      totalEmails: 0,
      sentEmails: 0,
      failedEmails: 0,
      pendingEmails: 0,
      cancelledEmails: 0,
      progress: 0,
    };
  } catch (error) {
    // Log error and return safe defaults
    console.error('Error calculating email counts:', error);
    return {
      totalEmails: 0,
      sentEmails: 0,
      failedEmails: 0,
      pendingEmails: 0,
      cancelledEmails: 0,
      progress: 0,
    };
  }
};

module.exports = mongoose.model('Email', EmailSchema, 'emails');
