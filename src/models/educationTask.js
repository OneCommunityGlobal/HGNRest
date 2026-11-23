const mongoose = require('mongoose');

const educationTaskSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    lessonPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LessonPlan',
      required: true,
    },
    // Embedded LessonPlan.subTasks._id; absent for legacy and atom assignments.
    subTaskId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
    },
    title: {
      type: String,
    },
    assignedDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    submission: {
      type: String,
    },

    atomIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Atom',
      },
    ],
    type: {
      type: String,
    },
    status: {
      type: String,
      default: 'Assigned',
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
educationTaskSchema.index({ status: 1 });
educationTaskSchema.index({ studentId: 1 });
educationTaskSchema.index({ lessonPlanId: 1 });
educationTaskSchema.index({ completedAt: -1 });

// Only identified subtask assignments participate; legacy/atom records are untouched.
educationTaskSchema.index(
  { lessonPlanId: 1, studentId: 1, subTaskId: 1 },
  { unique: true, partialFilterExpression: { subTaskId: { $type: 'objectId' } } },
);

module.exports = mongoose.model('EducationTask', educationTaskSchema);
