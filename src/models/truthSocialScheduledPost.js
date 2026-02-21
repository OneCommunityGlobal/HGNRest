const mongoose = require('mongoose');

const { Schema } = mongoose;

const truthSocialScheduledPostSchema = new Schema(
  {
    subject: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      required: true,
      maxlength: 500,
    },
    image: {
      type: String,
      default: null,
    },
    altText: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public',
    },
    tags: {
      type: String,
      default: '',
    },
    // --- IMPORTANT: This is the field needed for scheduling ---
    scheduledTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'posted', 'failed'],
      default: 'pending',
    },
    error: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

// Fix: Use the correct variable name here
truthSocialScheduledPostSchema.index({ scheduledTime: 1 });

// Check if model exists before compiling to avoid OverwriteModelError
module.exports =
  mongoose.models.TruthSocialScheduledPost ||
  mongoose.model('TruthSocialScheduledPost', truthSocialScheduledPostSchema);
