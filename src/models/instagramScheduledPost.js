const mongoose = require('mongoose');

const InstagramScheduledPostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    caption: {
      type: String,
      required: true,
    },

    mediaUrl: {
      type: String,
      required: true,
    },

    mediaType: {
      type: String,
      enum: ['IMAGE', 'VIDEO'],
      required: true,
    },

    mediaAltText: {
      type: String,
      default: null,
    },

    scheduledTime: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['scheduled', 'publishing', 'published', 'failed'],
      default: 'scheduled',
      index: true,
    },

    creationId: {
      type: String,
      default: null,
    },

    instagramMediaId: {
      type: String,
      default: null,
    },

    permalink: {
      type: String,
      default: null,
    },

    lastError: {
      type: String,
      default: null,
    },

    attempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('InstagramScheduledPost', InstagramScheduledPostSchema);
