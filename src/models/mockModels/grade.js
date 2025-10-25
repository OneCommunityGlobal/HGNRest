const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'task',
    required: true,
  },
  percentage: {
    type: Number, // e.g. 85.6
    min: 0,
    max: 100,
  },
  grade: {
    type: String, // e.g. "A", "B+", etc.
  },
  feedback: {
    type: String,
    trim: true,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Grade', gradeSchema);
