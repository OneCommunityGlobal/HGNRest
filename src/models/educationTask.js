const mongoose = require('mongoose');

const educationTaskSchema = new mongoose.Schema({
  lessonPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LessonPlan',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  atomIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Atom',
    required: true
  }],
  type: {
    type: String,
    required: true,
    enum: ['read', 'write', 'practice', 'quiz', 'project']
  },
  status: {
    type: String,
    required: true,
    enum: ['assigned', 'in_progress', 'completed', 'graded'],
    default: 'assigned'
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  dueAt: {
    type: Date,
    required: true
  },
  completedAt: {
    type: Date
  },
  uploadUrls: [{
    type: String,
    trim: true
  }],
  grade: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'F', 'pending'],
    default: 'pending'
  },
  feedback: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EducationTask', educationTaskSchema); 