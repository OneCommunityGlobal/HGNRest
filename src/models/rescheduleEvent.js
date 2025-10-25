const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming you have a User model
    required: true,
  },
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  status: {
    type: String,
    enum: ['Scheduled', 'Rescheduled', 'Cancelled'],
    default: 'Scheduled',
  },
  rescheduleHistory: [
    {
      oldDate: Date,
      newDate: Date,
      rescheduledAt: { type: Date, default: Date.now },
    },
  ],
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vote' }],
});

const Activity = mongoose.model('Activity', activitySchema);
module.exports = Activity;
