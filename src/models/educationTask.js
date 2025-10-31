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
      enum: ['assigned', 'in_progress', 'completed', 'graded'],
      default: 'assigned',
    },
    submissionStatus: {
      type: String,
      enum: ['Unsubmitted', 'Submitted', 'Grade Updated', 'Grade Posted'],
      default: 'Unsubmitted',
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
      default: 'pending',
    },
    marks: {
      type: Number,
      min: 0,
    },
    maxMarks: {
      type: Number,
      min: 0,
    },
    gradeType: {
      type: String,
      enum: ['letter', 'numeric'],
      default: 'letter',
    },
    gradeScale: {
      type: Map,
      of: Number,
    },
    educatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
    },
    gradeUpdatedAt: {
      type: Date,
    },
    gradePostedAt: {
      type: Date,
    },
    feedback: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('EducationTask', educationTaskSchema);
