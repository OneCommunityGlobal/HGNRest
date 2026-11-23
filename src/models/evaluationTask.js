const mongoose = require('mongoose');

const evaluationTaskSchema = new mongoose.Schema(
  {
    evaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentEvaluation',
      required: true,
      index: true,
    },
    taskName: {
      type: String,
      required: true,
      trim: true,
    },
    weightage: {
      type: Number,
      default: 0,
      min: 0,
    },
    marks: {
      type: Number,
      default: 0,
      min: 0,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      trim: true,
      default: 'pending',
    },
    feedback: {
      type: String,
      trim: true,
      default: '',
    },
    dueDate: {
      type: Date,
    },
    submissionDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'evaluationtasks',
  },
);

evaluationTaskSchema.index({ evaluationId: 1, taskName: 1 }, { unique: true });

module.exports = mongoose.model('EvaluationTask', evaluationTaskSchema);
