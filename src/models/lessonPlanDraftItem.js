const mongoose = require('mongoose');

const { Schema } = mongoose;

const LessonPlanDraftItemSchema = new Schema({
  draftId: {
    type: Schema.Types.ObjectId,
    ref: 'LessonPlanDraft',
    required: true,
  },

  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },

  atomId: {
    type: Schema.Types.ObjectId,
    ref: 'Atom',
    required: true,
  },

  name: String,
  description: String,
  studentReflection: String,
  strategyUsed: String,

  status: {
    type: String,
    enum: ['pending', 'awaiting_teacher_review', 'approved'],
    default: 'pending',
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

LessonPlanDraftItemSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});
module.exports = mongoose.model('LessonPlanDraftItem', LessonPlanDraftItemSchema);
