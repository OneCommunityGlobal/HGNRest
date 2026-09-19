const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * EmailThread Schema
 * Stores the thread-root Message-ID for blue-square and other system emails.
 * Ensures all emails in a weekly conversation for a user reference the same thread root.
 *
 * Fields:
 * - threadKey: Unique identifier for the thread (e.g., 'blue_square:userId:2025-11-14')
 * - threadRootMessageId: RFC-compliant Message-ID of the thread root (e.g., '<thread-userId-2025-11-14@onecommunityglobal.org>')
 * - weekStart: ISO date string marking the start of the week (e.g., '2025-11-14')
 * - emailType: Type of email thread (e.g., 'blue_square_assignment', 'weekly_summary')
 * - recipientUserId: Optional reference to the user receiving the email (ObjectId)
 * - createdAt: Timestamp when the thread root was created
 * - createdBy: Optional identifier for the system/user that created this thread
 * - metadata: Flexible object for additional context (e.g., { description: 'Weekly thread for user', attempts: 1 })
 */
const EmailThreadSchema = new Schema({
  threadKey: {
    type: String,
    required: true,
    unique: true, // Ensures no duplicate thread roots for same threadKey
    index: true, // Fast lookup by threadKey
    trim: true,
  },
  threadRootMessageId: {
    type: String,
    required: true,
    trim: true,
    // Example: '<thread-507f1f77bcf86cd799439011-2025-11-14@onecommunityglobal.org>'
  },
  weekStart: {
    type: String, // ISO date format 'YYYY-MM-DD'
    required: true,
    index: true, // Useful for querying all threads for a week
  },
  emailType: {
    type: String,
    enum: ['blue_square_assignment', 'weekly_summary', 'general'],
    default: 'general',
    index: true,
  },
  recipientUserId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'userProfile',
    index: true, // Lookup by user
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  createdBy: {
    type: String,
    default: 'system',
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
});

// Compound index on recipientUserId + weekStart for quick per-user-per-week lookup
EmailThreadSchema.index({ recipientUserId: 1, weekStart: 1 });

// Compound index on emailType + weekStart for analytics
EmailThreadSchema.index({ emailType: 1, weekStart: 1 });

module.exports = mongoose.model('emailThread', EmailThreadSchema, 'emailThreads');
