const mongoose = require('mongoose');

const { Schema } = mongoose;

const announcementSchema = new Schema(
  {
    announcement_id: {
      type: Number,
      required: true,
      unique: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'userProfile',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    audience: {
      type: String,
      required: true,
      enum: ['students', 'educators', 'support'],
      default: 'all',
    },
    created_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    optimisticConcurrency: true,
    timestamps: true, // This will also add updatedAt field
  },
);

// Indexes for better query performance
announcementSchema.index({ user_id: 1, created_at: -1 });
announcementSchema.index({ audience: 1, created_at: -1 });
announcementSchema.index({ created_at: -1 });

// Virtual for creator info
announcementSchema.virtual('creatorInfo', {
  ref: 'userProfile',
  localField: 'user_id',
  foreignField: '_id',
  justOne: true,
  options: { select: 'firstName lastName email' },
});

// Ensure virtual fields are serialized
announcementSchema.set('toJSON', { virtuals: true });
announcementSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('announcement', announcementSchema, 'announcements');
