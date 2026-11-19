const mongoose = require('mongoose');

const educationTaskSchema = new mongoose.Schema(
  {
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
      ref: 'userProfile',
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
      enum: ['A', 'B', 'C', 'D', 'F', 'pending'],
      default: 'pending',
    },
    feedback: {
      type: String,
      trim: true,
    },
    suggestedTotalHours: {
      type: Number,
      default: 0,
    },
    loggedHours: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Only identified subtask assignments participate; legacy/atom records are untouched.
educationTaskSchema.index(
  { lessonPlanId: 1, studentId: 1, subTaskId: 1 },
  { unique: true, partialFilterExpression: { subTaskId: { $type: 'objectId' } } },
);

module.exports = mongoose.model('EducationTask', educationTaskSchema);
