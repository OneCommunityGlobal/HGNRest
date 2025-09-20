const mongoose = require('mongoose');

const { Schema } = mongoose;

const applicationAnalyticsSchema = new Schema({
  country: {
    type: String,
    required: true,
    maxLength: 3, // ISO country code (e.g., 'US', 'CA', 'GB')
    index: true,
  },
  numberOfApplicants: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  role: {
    type: String,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  createdDatetime: {
    type: Date,
    default: Date.now,
  },
  modifiedDatetime: {
    type: Date,
    default: Date.now,
  },
});

// Compound indexes for efficient querying
applicationAnalyticsSchema.index({ country: 1, role: 1, timestamp: -1 });
applicationAnalyticsSchema.index({ timestamp: -1, country: 1 });
applicationAnalyticsSchema.index({ role: 1, timestamp: -1 });

// Update modifiedDatetime on save
applicationAnalyticsSchema.pre('save', function (next) {
  this.modifiedDatetime = new Date();
  next();
});

module.exports = mongoose.model(
  'applicationAnalytics',
  applicationAnalyticsSchema,
  'applicationAnalytics',
);
