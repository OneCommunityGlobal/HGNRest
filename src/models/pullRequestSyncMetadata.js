const mongoose = require('mongoose');

const { Schema } = mongoose;

const pullRequestSyncMetadata = new Schema(
  {
    name: { type: String, required: true, unique: true }, // e.g. "github_review_sync"
    lastSyncedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PullRequestSyncMetadata', pullRequestSyncMetadata);
