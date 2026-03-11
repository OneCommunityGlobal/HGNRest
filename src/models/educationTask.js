const mongoose = require('mongoose');

const { Schema } = mongoose;

// This schema is specifically for tasks assigned from an educator's lesson plan.
const educationTaskSchema = new Schema(
  {
    studentId: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    lessonPlanId: { type: mongoose.SchemaTypes.ObjectId, ref: 'LessonPlan', required: true },
    // Storing who clicked the "Assign" button
    assignedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    // Storing the details of the specific sub-task from the lesson plan
    title: { type: String, required: true },
    assignedDate: { type: Date },
    dueDate: { type: Date },
    status: { type: String, default: 'Assigned' }, // e.g., Assigned, In Progress, Completed
    submission: { type: String }, // To store student's work if applicable
  },
  { timestamps: true },
);

module.exports = mongoose.model('educationTask', educationTaskSchema);
