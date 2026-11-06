const mongoose = require('mongoose');

const { Schema } = mongoose;

// Delivery state for a scheduled post:
// pending -> publishing (claimed by one worker) -> posted | failed.
// Records created before this field existed have no status and are treated as pending.
const DELIVERY_STATUSES = ['pending', 'publishing', 'posted', 'failed'];

const imgurPostSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserProfile',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 256,
    },
    description: {
      type: String,
      maxlength: 16777216,
    },
    images: [
      {
        filename: String,
        size: Number,
        mimetype: String,
        buffer: Buffer, // Store image data as base64 or buffer
      },
    ],
    status: {
      type: String,
      enum: DELIVERY_STATUSES,
      default: 'pending',
      index: true,
    },
    scheduledTime: {
      type: Date,
      required: true,
      index: true,
    },
    postedAt: {
      type: Date,
    },
    remotePostId: {
      type: String,
    },
    albumId: {
      type: String,
    },
    imgurUrl: {
      type: String,
    },
    lastError: {
      type: String,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lockOwner: {
      type: String,
    },
    lockedUntil: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Composite index for efficient querying of pending/publishing posts scheduled for near future
imgurPostSchema.index({ status: 1, scheduledTime: 1 });
// Index for user history
imgurPostSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ImgurPost', imgurPostSchema, 'imgurposts');
module.exports.DELIVERY_STATUSES = DELIVERY_STATUSES;
