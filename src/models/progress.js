const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  atomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Atom',
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started'
  },
  firstStartedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
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

// Compound index to ensure unique progress tracking per student-atom combination
progressSchema.index({ studentId: 1, atomId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema); 