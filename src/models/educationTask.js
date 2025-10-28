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
    name: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['read', 'write', 'practice', 'quiz', 'project'],
    },
    weightage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
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
    submittedAt: {
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
    pageComments: [
      {
        pageNumber: {
          type: Number,
          required: true,
        },
        comment: {
          type: String,
          required: true,
        },
        isPrivate: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'userProfile',
        },
      },
    ],
    changeRequests: [
      {
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          required: true,
        },
        requestedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'userProfile',
          required: true,
        },
        resolved: {
          type: Boolean,
          default: false,
        },
        resolvedAt: {
          type: Date,
        },
      },
    ],
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
    },
    draftSaved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('EducationTask', educationTaskSchema);
