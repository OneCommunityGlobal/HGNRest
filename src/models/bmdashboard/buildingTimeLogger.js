const mongoose = require('mongoose');

const { Schema } = mongoose;

const bmTimeLogInterval = new Schema({
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // Duration in milliseconds
    default: 0
  }
});

const bmTimeLog = new Schema({
  project: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'buildingProject',
    required: true
  },
  member: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'userProfile',
    required: true
  },
  task: {
    type: String,
    required: true
  },
    intervals: {
    type: [bmTimeLogInterval],
    default: [] 
  },
  totalElapsedTime: {
    type: Number, // Total elapsed time in milliseconds
    default: 0
  },
  status: {
    type: String,
    enum: ['ongoing', 'paused', 'completed'],
    default: 'ongoing'
  },
  currentIntervalStarted: {
    type: Date
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('bmTimelog', bmTimeLog);