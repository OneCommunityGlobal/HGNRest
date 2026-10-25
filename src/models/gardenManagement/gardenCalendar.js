const mongoose = require('mongoose');

const gardenCalendarSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['seeding', 'transplanting', 'succession', 'harvesting'],
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    location: {
      type: String,
      trim: true,
    },

    date: {
      type: Date,
    },

    from: {
      type: String,
      trim: true,
    },

    to: {
      type: String,
      trim: true,
    },

    lastSow: {
      type: Date,
    },

    nextSow: {
      type: Date,
    },

    interval: {
      type: String,
      trim: true,
    },

    expected: {
      type: Date,
    },

    yield: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ['upcoming', 'active', 'growing', 'completed'],
      default: 'upcoming',
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('GardenCalendar', gardenCalendarSchema);
