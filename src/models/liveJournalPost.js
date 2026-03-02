const mongoose = require('mongoose');

const liveJournalPostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserProfile',
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      select: false,
    },
    subject: {
      type: String,
      maxlength: 255,
      default: 'Untitled',
    },
    content: {
      type: String,
      required: true,
      maxlength: 16777216,
    },
    security: {
      type: String,
      enum: ['public', 'private', 'friends'],
      default: 'public',
    },
    tags: {
      type: String,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['posted', 'scheduled', 'failed'],
      default: 'scheduled',
      index: true,
    },
    scheduledFor: {
      type: Date,
      index: true,
    },
    postedAt: {
      type: Date,
    },
    ljItemId: {
      type: String,
    },
    ljUrl: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

liveJournalPostSchema.index({ status: 1, scheduledFor: 1 });
liveJournalPostSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('LiveJournalPost', liveJournalPostSchema, 'livejournalposts');
