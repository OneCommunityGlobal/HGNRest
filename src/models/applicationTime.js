const mongoose = require('mongoose');

const { Schema } = mongoose;

const applicationTimeSchema = new Schema({
  role: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  jobId: {
    type: String,
    required: true,
    index: true,
  },
  jobTitle: {
    type: String,
    required: true,
  },
  clickedAt: {
    type: Date,
    required: true,
    index: true,
  },
  appliedAt: {
    type: Date,
    required: true,
    index: true,
  },
  timeTaken: {
    type: Number, // Time in seconds
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  deviceType: {
    type: String,
    enum: ['mobile', 'desktop', 'tablet'],
    default: 'desktop',
  },
  location: {
    country: {
      type: String,
      default: 'Unknown',
    },
    state: {
      type: String,
      default: 'Unknown',
    },
  },
  isOutlier: {
    type: Boolean,
    default: false,
    index: true,
  },
}, { 
  timestamps: true 
});

// Indexes for efficient querying
applicationTimeSchema.index({ role: 1, appliedAt: 1 });
applicationTimeSchema.index({ appliedAt: 1, role: 1 });
applicationTimeSchema.index({ timeTaken: 1 });
applicationTimeSchema.index({ isOutlier: 1, role: 1 });

// Virtual for time taken in minutes
applicationTimeSchema.virtual('timeTakenMinutes').get(function() {
  return Math.round(this.timeTaken / 60 * 100) / 100; // Round to 2 decimal places
});

// Virtual for time taken in hours
applicationTimeSchema.virtual('timeTakenHours').get(function() {
  return Math.round(this.timeTaken / 3600 * 100) / 100; // Round to 2 decimal places
});

// Ensure virtual fields are serialized
applicationTimeSchema.set('toJSON', { virtuals: true });
applicationTimeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ApplicationTime', applicationTimeSchema, 'applicationTimes');