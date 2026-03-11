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

// UPDATED: This now matches your database structure and adds the subTasks array.
const lessonPlanSchema = new Schema(
  {
    title: { type: String, required: true }, // Matches your 'title' field
    description: { type: String }, // Matches your 'description' field
    subTasks: [subTaskSchema], // The array of sub-tasks needed for assignments
    // Store who originally created this lesson plan
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'userProfile' },
    // Store who last modified this lesson plan
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'userProfile' },
  },
  {
    timestamps: true, // This will automatically manage createdAt and updatedAt fields
  },
);

module.exports = mongoose.model('LessonPlan', lessonPlanSchema, 'lessonplans');
