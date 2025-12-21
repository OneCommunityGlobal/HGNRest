const mongoose = require('mongoose');

const { Schema } = mongoose;

const timelogTrackingSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'userProfile' },
  eventType: {
    type: String,
    required: true,
    enum: ['Timelog Resumed', 'Timelog Paused', 'Time Logged', 'Automatic Pause'],
  },
  timestamp: { type: Date, required: true, default: Date.now }, // Stored in UTC
  createdAt: { type: Date, default: Date.now },
});

timelogTrackingSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('timelogTracking', timelogTrackingSchema, 'timelogTrackings');
