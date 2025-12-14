const mongoose = require('mongoose');

const { Schema } = mongoose;

const LessonPlanDraftSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },

  educatorId: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },

  templateId: {
    type: Schema.Types.ObjectId,
    ref: 'LessonPlanTemplate',
    required: true,
  },

  selectedTopics: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Atom',
    },
  ],

  activities: [
    {
      description: String,
      reason: String,
      strategy: String,
    },
  ],

  status: {
    type: String,
    enum: ['drafting', 'submitted_to_teacher', 'in_review', 'approved'],
    default: 'drafting',
  },

  lessonPlanId: {
    type: Schema.Types.ObjectId,
    ref: 'LessonPlan',
    default: null,
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

LessonPlanDraftSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('LessonPlanDraft', LessonPlanDraftSchema);
