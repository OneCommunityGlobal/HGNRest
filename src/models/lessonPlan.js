const mongoose = require('mongoose');

const lessonPlanSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    gradeLevel: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    objectives: {
      type: [String],
      default: [],
    },
    content: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'approved'],
      default: 'draft',
      required: true,
    },
    collaborators: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['editor', 'viewer'], default: 'editor' },
      },
    ],
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    versionHistory: [
      {
        editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updatedAt: { type: Date, default: Date.now },
        changes: { type: String },
      },
    ],
  },
  { timestamps: true },
);

lessonPlanSchema.index({ title: 1, subject: 1 });

const LessonPlan = mongoose.model('LessonPlan', lessonPlanSchema);
module.exports = LessonPlan;
