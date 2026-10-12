const mongoose = require('mongoose');

const applicationTimeSchema = new mongoose.Schema(
  {
    location: {
      country: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
    },
    deviceType: {
      type: String,
      required: true,
    },
    isOutlier: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    jobId: {
      type: String,
      required: true,
    },
    jobTitle: {
      type: String,
      required: true,
    },
    clickedAt: {
      type: Date,
    },
    appliedAt: {
      type: Date,
    },
    timeTaken: {
      type: Number,
    },
    sessionId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const ApplicationTimeModel = mongoose.model('ApplicationTime', applicationTimeSchema);

module.exports = ApplicationTimeModel;
