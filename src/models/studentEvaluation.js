const mongoose = require('mongoose');

const studentEvaluationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    weightage: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    marks: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Unknown maximum marks must not be inferred from a percentage.
    // Null leaves legacy totals unavailable; an explicitly supplied zero remains valid.
    maxMarks: {
      type: Number,
      default: null,
      min: 0,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    performanceLevel: {
      type: String,
      trim: true,
      default: '',
    },
    feedback: {
      type: String,
      trim: true,
      default: '',
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
    },
  },
  {
    timestamps: true,
    collection: 'evaluations',
  },
);

studentEvaluationSchema.index({ studentId: 1, category: 1 }, { unique: true });
studentEvaluationSchema.index({ studentId: 1, updatedAt: -1 });

module.exports = mongoose.model('StudentEvaluation', studentEvaluationSchema);
