const mongoose = require('mongoose');
const { EMAIL_CONFIG } = require('../config/emailConfig');

/**
 * Email (parent) model for announcement sending lifecycle.
 * - Stores subject/html and status transitions (PENDING → SENDING → SENT/PROCESSED/FAILED).
 * - References creator and tracks timing fields for auditing.
 */
const { Schema } = mongoose;

const EmailSchema = new Schema({
  subject: {
    type: String,
    required: [true, 'Subject is required'],
  },
  htmlContent: {
    type: String,
    required: [true, 'HTML content is required'],
  },
  status: {
    type: String,
    enum: Object.values(EMAIL_CONFIG.EMAIL_STATUSES),
    default: EMAIL_CONFIG.EMAIL_STATUSES.PENDING,
    index: true,
  },
  // Optional template reference for tracking which template was used
  templateId: {
    type: Schema.Types.ObjectId,
    ref: 'EmailTemplate',
    index: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: [true, 'createdBy is required'],
  },
  createdAt: { type: Date, default: () => new Date(), index: true },
  startedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  updatedAt: { type: Date, default: () => new Date() },
});

// Update timestamps and validate basic constraints
EmailSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Add indexes for better performance
EmailSchema.index({ status: 1, createdAt: 1 });
EmailSchema.index({ createdBy: 1, createdAt: -1 });
EmailSchema.index({ startedAt: 1 });
EmailSchema.index({ completedAt: 1 });
EmailSchema.index({ templateId: 1, createdAt: -1 }); // For template usage tracking

module.exports = mongoose.model('Email', EmailSchema, 'emails');
