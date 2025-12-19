const mongoose = require('mongoose');

const studentBadgesSchema = new mongoose.Schema(
  {
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
      required: [true, 'Student ID is required'],
      index: true,
    },
    badge_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'epBadge',
      required: [true, 'Badge ID is required'],
      index: true,
    },
    awarded_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    awarded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
      default: null,
      description: 'User who manually awarded the badge, null for automatic awards',
    },
    reason: {
      type: String,
      enum: {
        values: ['capstone_completion', 'lesson_completion', 'manual_award', 'milestone'],
        message: '{VALUE} is not a valid reason',
      },
      required: [true, 'Reason is required'],
      index: true,
    },
    is_revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revoked_at: {
      type: Date,
      default: null,
    },
    revoke_reason: {
      type: String,
      trim: true,
      maxlength: [200, 'Revoke reason cannot exceed 200 characters'],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Additional metadata about badge award (e.g., lesson ID, capstone details)',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

studentBadgesSchema.index({ student_id: 1, badge_id: 1, is_revoked: 1 });
studentBadgesSchema.index({ student_id: 1, awarded_at: -1 });
studentBadgesSchema.index({ student_id: 1, reason: 1, is_revoked: 1 });
studentBadgesSchema.index({ badge_id: 1, is_revoked: 1 });
studentBadgesSchema.index({ awarded_at: -1, is_revoked: 1 });

studentBadgesSchema.index(
  { student_id: 1, badge_id: 1 },
  {
    unique: true,
    partialFilterExpression: { is_revoked: false },
    name: 'unique_active_badge_per_student',
  }
);

studentBadgesSchema.pre('save', function(next) {
  if (this.isModified('is_revoked') && this.is_revoked && !this.revoked_at) {
    this.revoked_at = new Date();
  }
  next();
});

studentBadgesSchema.methods.revoke = function(reason) {
  this.is_revoked = true;
  this.revoked_at = new Date();
  this.revoke_reason = reason;
  return this.save();
};

studentBadgesSchema.statics.getActiveByStudent = function(studentId) {
  return this.find({ student_id: studentId, is_revoked: false })
    .populate('badge_id')
    .populate('awarded_by', 'firstname lastname')
    .sort({ awarded_at: -1 });
};

studentBadgesSchema.statics.getByReason = function(studentId, reason) {
  return this.find({ student_id: studentId, reason, is_revoked: false })
    .populate('badge_id')
    .sort({ awarded_at: -1 });
};

module.exports = mongoose.model('studentBadges', studentBadgesSchema, 'studentbadges');