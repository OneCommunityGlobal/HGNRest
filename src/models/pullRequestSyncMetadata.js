const mongoose = require('mongoose');

const { Schema } = mongoose;

const pullRequestSyncMetadata = new Schema(
  {
    jobDate: { type: Date, required: true, unique: true },
    lastSyncedAt: { type: Date, required: true },
    status: { type: String },
    notes: { type: String },
  },
  { timestamps: true },
);

pullRequestSyncMetadata.index({ jobDate: 1 }, { unique: true });

module.exports = mongoose.model('PullRequestSyncMetadata', pullRequestSyncMetadata);
