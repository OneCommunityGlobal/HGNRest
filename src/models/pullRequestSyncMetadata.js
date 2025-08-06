const mongoose = require('mongoose');

const { Schema } = mongoose;

const pullRequestSyncMetadata = new Schema(
  {
    lastSyncedAt: { type: Date, required: true },
    status: { type: String },
    notes: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PullRequestSyncMetadata', pullRequestSyncMetadata);
