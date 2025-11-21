const mongoose = require('mongoose');

const { Schema } = mongoose;

const studentMetricsSchema = new Schema({
  studentId: { type: String, required: true, index: true },
  metrics: {
    averageScore: { type: Number, default: 0 },
    totalTimeSpentMinutes: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    assessmentsTaken: { type: Number, default: 0 },
  },
  lastUpdated: { type: Date, default: Date.now, index: true },
});

studentMetricsSchema.pre('save', function (next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('StudentMetrics', studentMetricsSchema, 'studentMetrics');
