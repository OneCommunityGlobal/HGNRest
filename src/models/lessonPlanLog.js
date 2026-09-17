const mongoose = require('mongoose');

const { Schema } = mongoose;

// This schema stores the history of edits and assignments for a Lesson Plan
const lessonPlanLogSchema = new Schema(
  {
    // The lesson plan that was changed
    lessonPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonPlan', required: true },

    // The admin/educator who made the change
    editorId: { type: mongoose.Schema.Types.ObjectId, ref: 'userProfile', required: true },

    // The action they took (e.g., "Manual Assignment", "Plan Saved")
    action: { type: String, required: true },

    // Details of the action (e.g., "Assigned to 1391 students.")
    details: { type: String },

    // This will be used for the "Log Date" column
    logDateTime: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('LessonPlanLog', lessonPlanLogSchema, 'lessonplanlogs');
