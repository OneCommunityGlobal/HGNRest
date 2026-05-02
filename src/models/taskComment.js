const mongoose = require('mongoose');

const TaskCommentSchema = new mongoose.Schema({
  taskId: {
    type: String,
    ref: 'StudentTask',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserTask',
    required: true,
  },
  commentText: {
    type: String,
    required: true,
    trim: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },

  isDeleted: {
    type: Boolean,
    default: false,
  },
});

TaskCommentSchema.pre(/^find/, function (next) {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

module.exports = mongoose.model('TaskComment', TaskCommentSchema, 'taskcomment');
