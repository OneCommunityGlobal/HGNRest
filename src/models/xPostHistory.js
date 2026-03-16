const mongoose = require('mongoose');

const xPostHistorySchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      maxlength: 280,
    },
    xPostId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['posted', 'failed'],
      required: true,
    },
    source: {
      type: String,
      enum: ['direct', 'scheduled'],
      default: 'direct',
    },
    errorMessage: {
      type: String,
      default: null,
    },
    postedAt: {
      type: Date,
      default: null,
    },
    scheduledPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'XScheduledPost',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('XPostHistory', xPostHistorySchema, 'xPostHistory');
