const mongoose = require('mongoose');

const studentBadgesSchema = new mongoose.Schema(
  {
    student_badge_id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    badge_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'epBadge',
      required: true,
      index: true,
    },
    awarded_at: {
      type: Date,
      default: Date.now,
    },
    awarded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reason: {
      type: String,
      enum: ['capstone_completion', 'lesson_completion', 'manual_award', 'milestone'],
      required: true,
    },
    is_revoked: {
      type: Boolean,
      default: false,
    },
    revoked_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

studentBadgesSchema.index({ student_id: 1, badge_id: 1, is_revoked: 1 });

module.exports = mongoose.model('studentBadges', studentBadgesSchema);