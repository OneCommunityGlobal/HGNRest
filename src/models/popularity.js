const mongoose = require('mongoose');

const PopularitySchema = new mongoose.Schema(
  {
    month: {
      type: String, // e.g. "January 2025"
      required: true,
    },
    hitsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    applicationsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    role: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'popularityTimeline' },
);

// Indexes to speed up common queries
PopularitySchema.index({ timestamp: 1 });
PopularitySchema.index({ role: 1 });
PopularitySchema.index({ month: 1 });

module.exports = mongoose.model('popularity', PopularitySchema);
