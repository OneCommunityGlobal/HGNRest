const mongoose = require('mongoose');

const { Schema } = mongoose;

const taskChangeLogSchema = new Schema(
  {
    taskId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'task',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'userProfile',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: String,
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    changeType: {
      type: String,
      enum: [
        'field_change',
        'status_change',
        'assignment_change',
        'deadline_change',
        'priority_change',
        'hours_change',
        'task_created',
        'task_deleted',
      ],
      required: true,
    },
    field: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    oldValueFormatted: String,
    newValueFormatted: String,
    changeDescription: String,
    ipAddress: String,
    userAgent: String,
    sessionId: String,
    metadata: {
      source: {
        type: String,
        default: 'web_ui',
      },
      reason: String,
      relatedChanges: [mongoose.SchemaTypes.ObjectId],
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for efficient queries
taskChangeLogSchema.index({ taskId: 1, timestamp: -1 });
taskChangeLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('TaskChangeLog', taskChangeLogSchema, 'taskChangeLogs');
