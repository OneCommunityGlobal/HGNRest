const mongoose = require('mongoose');

const taskChangeLogSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile',
    required: true,
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  action: {
    type: String,
    enum: ['create', 'update', 'delete', 'assign', 'unassign', 'status_change'],
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
});

// Index for efficient queries
taskChangeLogSchema.index({ taskId: 1, timestamp: -1 });
taskChangeLogSchema.index({ userId: 1, timestamp: -1 });

const TaskChangeLog = mongoose.model('TaskChangeLog', taskChangeLogSchema);

module.exports = TaskChangeLog;
