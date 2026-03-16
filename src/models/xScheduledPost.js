const mongoose = require('mongoose');

const xScheduledPostSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      maxlength: 280,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'posted', 'failed'],
      default: 'scheduled',
    },
    postedAt: {
      type: Date,
      default: null,
    },
    xPostId: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
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

module.exports = mongoose.model('XScheduledPost', xScheduledPostSchema, 'xScheduledPosts');
