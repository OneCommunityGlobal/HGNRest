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
  intervals: [bmTimeLogInterval],
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

// Virtual to calculate current session duration
bmTimeLog.virtual('currentSessionDuration').get(function() {
  if (this.status === 'ongoing' && this.currentIntervalStarted) {
    return Date.now() - this.currentIntervalStarted.getTime();
  }
  return 0;
});

// Method to calculate total elapsed time
bmTimeLog.methods.calculateTotalElapsedTime = function() {
  let totalTime = this.intervals.reduce((total, interval) => {
    return total + (interval.duration || 0);
  }, 0);

  // Add current session duration if still ongoing
  if (this.status === 'ongoing' && this.currentIntervalStarted) {
    totalTime += (Date.now() - this.currentIntervalStarted.getTime());
  }

  return totalTime;
};

module.exports = mongoose.model('bmTimelog', bmTimeLog);