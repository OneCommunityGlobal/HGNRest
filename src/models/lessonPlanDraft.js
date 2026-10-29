const mongoose = require('mongoose');

const { Schema } = mongoose;

const lessonPlanDraftSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'userProfile',
      required: true,
    },
    educatorId: {
      type: Schema.Types.ObjectId,
      ref: 'userProfile',
      default: null,
    },
    goals: {
      type: [String],
      default: [],
    },
    topics: {
      type: [String],
      default: [],
    },
    suggestedTasks: {
      type: [String],
      default: [],
    },
    assessmentForms: {
      type: [
        {
          title: { type: String, required: true },
          description: { type: String },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ['draft', 'active'],
      default: 'draft',
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('LessonPlanDraft', lessonPlanDraftSchema, 'lessonplandrafts');
