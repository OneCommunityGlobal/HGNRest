const mongoose = require('mongoose');

const educationTaskSchema = new mongoose.Schema(
  {
    lessonPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LessonPlan',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
      required: true,
    },
    atomIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Atom',
        required: true,
      },
    ],
    type: {
      type: String,
      required: true,
      enum: ['read', 'write', 'practice', 'quiz', 'project'],
    },
    status: {
      type: String,
      required: true,
      enum: [
        'assigned',
        'in_progress',
        'submitted',
        'in_review',
        'changes_requested',
        'completed',
        'graded',
      ],
      default: 'assigned',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    dueAt: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
    },
    uploadUrls: [
      {
        type: String,
        trim: true,
      },
    ],
    grade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'F', 'pending'],
      default: 'pending',
    },
    feedback: {
      type: String,
      trim: true,
    },
    reviewStatus: {
      type: String,
      enum: ['not_submitted', 'pending_review', 'in_review', 'changes_requested', 'graded'],
      default: 'not_submitted',
    },
    reviewStartedAt: {
      type: Date,
    },
    reviewedAt: {
      type: Date,
    },
    lastSavedAt: {
      type: Date,
    },
    totalMarks: {
      type: Number,
      default: 100,
    },
    marksGiven: {
      type: Number,
    },
    collaborativeFeedback: {
      type: String,
      trim: true,
    },
    privateNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('EducationTask', educationTaskSchema);
