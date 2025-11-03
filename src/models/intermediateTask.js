const mongoose = require('mongoose');

const intermediateTaskSchema = new mongoose.Schema(
  {
    parent_task_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EducationTask',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    expected_hours: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    due_date: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('IntermediateTask', intermediateTaskSchema);
