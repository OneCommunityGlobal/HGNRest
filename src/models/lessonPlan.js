const mongoose = require('mongoose');

const { Schema } = mongoose;

// This schema defines the structure for a single sub-task within a lesson plan.
const subTaskSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String }, // e.g., 'Write-only', 'Read-only'
    dueDate: { type: Date },
    passMark: { type: String },
    weight: { type: String },
  },
  { _id: true },
); // Ensure sub-tasks get their own IDs

// Merged: Combines incoming properties (theme, dates, activities) with current properties (subTasks, lastEditedBy)
const lessonPlanSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    theme: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    subTasks: [subTaskSchema], // The array of sub-tasks needed for assignments
    activities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
      required: true, // Kept strict requirement from incoming
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
    },
  },
  {
    timestamps: true, // This will automatically manage createdAt and updatedAt fields
  },
);

module.exports = mongoose.model('LessonPlan', lessonPlanSchema, 'lessonplans');