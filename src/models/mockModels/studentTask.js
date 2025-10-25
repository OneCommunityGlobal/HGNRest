const mongoose = require('mongoose');

const { Schema } = mongoose;

const studentTaskSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  taskId: {
    type: Schema.Types.ObjectId,
    ref: 'task',
    required: true,
  },
  status: {
    type: String,
    enum: ['incomplete', 'in_progress', 'completed', 'graded'],
    default: 'incomplete',
  },
  deadline: {
    type: Date,
  },
  // checkoffset
  assignment_timestamp: {
    type: Date,
    default: Date.now,
  },
  lessonPlanId: {
    type: Schema.Types.ObjectId,
    ref: 'LessonPlan',
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
  },
  colorLevel: {
    type: String,
  },
  activityGroup: {
    type: Schema.Types.ObjectId,
    ref: 'Activity',
  },
  teachingStrategy: {
    type: Schema.Types.ObjectId,
    ref: 'Strategy',
  },
  lifeStrategy: {
    type: Schema.Types.ObjectId,
    ref: 'Strategy',
  },
  isAutoAssigned: {
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
  completedAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('StudentTasks', studentTaskSchema);
