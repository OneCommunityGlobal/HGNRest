const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * EmailHistory Schema
 * Tracks all outgoing emails with full headers, thread information, and delivery status.
 * Enables debugging, compliance auditing, and thread reconstruction.
 *
 * New threading-related fields:
 * - messageId: RFC-compliant Message-ID unique to this email (e.g., '<msg-12345@onecommunityglobal.org>')
 * - threadRootMessageId: Message-ID of the thread root this email belongs to
 * - references: Array of Message-IDs in the conversation chain (RFC standard for threads)
 * - sentAt: Timestamp when email was successfully sent
 * - recipientUserId: ObjectId reference to the user who received this email
 * - weekStart: ISO date of the week when email was sent (for easy filtering)
 * - threadKey: The thread key used to organize emails (e.g., 'blue_square:userId:2025-11-16')
 */
const EmailHistorySchema = new Schema({
  uniqueKey: {
    type: String,
    required: true,
    index: true,
    unique: true, // enforce uniqueness at DB level
  },
  to: [String],
  cc: [String],
  bcc: [String],
  subject: String,
  message: String,
  status: { type: String, enum: ['SENT', 'FAILED', 'QUEUED'], default: 'QUEUED' },
  attempts: { type: Number, default: 0 },
  error: String,
  updatedAt: { type: Date, default: Date.now },

  // ============ Threading & Header Fields ============
  messageId: {
    type: String,
    trim: true,
    index: true, // Fast lookup by message ID
    // Example: '<msg-abc123def456-1731614400000@onecommunityglobal.org>'
  },
  threadRootMessageId: {
    type: String,
    trim: true,
    index: true, // Fast lookup to find all messages in a thread
    // Example: '<thread-507f1f77bcf86cd799439011-2025-11-16@onecommunityglobal.org>'
  },
  references: {
    type: [String], // Array of Message-IDs in the conversation chain
    default: [], // RFC 5322: For replies, include Message-IDs of prior messages
    // Example: ['<thread-root@domain>', '<msg-first-reply@domain>']
  },
  sentAt: {
    type: Date,
    index: true, // Useful for time-range queries (e.g., emails sent last week)
    // Set when email is successfully sent
  },
  recipientUserId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'userProfile',
    index: true, // Fast lookup of all emails sent to a specific user
  },
  weekStart: {
    type: String, // ISO date format 'YYYY-MM-DD'
    index: true, // Query all emails sent during a specific week
  },
  threadKey: {
    type: String, // Composite key like 'blue_square:userId:2025-11-16'
    index: true, // Fast lookup of all emails in a thread
  },
  // ============ Email Type & Metadata ============
  emailType: {
    type: String,
    enum: ['blue_square_assignment', 'weekly_summary', 'general', 'password_reset'],
    default: 'general',
    index: true,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
    // Flexible field for additional context (e.g., { userId: '...', infringementCount: 3 })
  },
});

// Compound indexes for efficient querying
EmailHistorySchema.index({ recipientUserId: 1, weekStart: 1 }); // All emails for user in a week
EmailHistorySchema.index({ threadRootMessageId: 1, sentAt: 1 }); // All messages in a thread, ordered by time
EmailHistorySchema.index({ emailType: 1, status: 1, sentAt: 1 }); // Analytics: type + status + time

module.exports = mongoose.model('emailHistory', EmailHistorySchema, 'emailHistory');
