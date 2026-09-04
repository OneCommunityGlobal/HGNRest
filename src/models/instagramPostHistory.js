const mongoose = require('mongoose');

const InstagramPostHistorySchema = new mongoose.Schema(
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
      default: null,
    },

    mediaType: {
      type: String,
      enum: ['IMAGE', 'VIDEO'],
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

    postedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    status: {
      type: String,
      enum: ['published', 'failed'],
      required: true,
    },

    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('InstagramPostHistory', InstagramPostHistorySchema);
