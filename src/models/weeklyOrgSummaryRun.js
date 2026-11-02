const mongoose = require('mongoose');

const { Schema } = mongoose;

// running -> sent | failed | disabled (email sending is switched off in this environment). runKey is the Sunday that starts the reported week, and its
// unique index is what stops a retry or a second server instance from sending twice.
const RUN_STATUSES = ['running', 'sent', 'failed', 'disabled'];

const weeklyOrgSummaryRun = new Schema({
  runKey: { type: String, required: true, unique: true },
  status: { type: String, enum: RUN_STATUSES, default: 'running' },
  trigger: { type: String, enum: ['schedule', 'manual'], default: 'schedule' },
  attempts: { type: Number, default: 0 },
  scheduledFor: { type: Date },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  leaseUntil: { type: Date },
  recipients: { type: [String], default: [] },
  // Recipients already emailed, so a retry after a partial failure only sends to the rest.
  sentTo: { type: [String], default: [] },
  attachments: { type: [String], default: [] },
  subject: { type: String },
  error: { type: String },
  alertSentAt: { type: Date },
});

module.exports = mongoose.model('weeklyOrgSummaryRun', weeklyOrgSummaryRun);
module.exports.RUN_STATUSES = RUN_STATUSES;
