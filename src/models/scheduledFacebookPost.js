const mongoose = require('mongoose');

const { Schema } = mongoose;

const ScheduledFacebookPostSchema = new Schema(
  {
    message: { type: String, default: '' },
    link: { type: String },
    imageUrl: { type: String },
    imageData: { type: Buffer, default: null },
    imageMimeType: { type: String, default: null },
    imageOriginalName: { type: String, default: null },
    pageId: { type: String },
    scheduledFor: { type: Date, required: true },
    timezone: { type: String, default: 'America/Los_Angeles' },
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    postedAt: { type: Date },
    postId: { type: String },
    postType: { type: String },
    postMethod: {
      type: String,
      enum: ['direct', 'scheduled'],
      default: 'scheduled',
    },
    lastError: { type: String },
    createdBy: {
      userId: { type: String },
      role: { type: String },
      permissions: { type: Schema.Types.Mixed },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ScheduledFacebookPost', ScheduledFacebookPostSchema);
