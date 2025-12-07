const mongoose = require('mongoose');

const { Schema } = mongoose;

const pullRequestSyncMetadata = new Schema(
  {
    jobId: { type: String, required: true, unique: true },
    lastSyncedAt: { type: Date, required: true },
    status: { type: String, enum: ['PENDING', 'SUCCESS', 'ERROR'], default: 'PENDING' },
    notes: { type: String },
    remainingFrontEndPRs: [
      {
        number: { type: String },
        created_at: { type: Date },
        title: { type: String },
      },
    ],
    remainingBackEndPRs: [
      {
        number: { type: String },
        created_at: { type: Date },
        title: { type: String },
      },
    ],
  },
  { timestamps: true },
);

pullRequestSyncMetadata.index({ jobId: 1 }, { unique: true });

module.exports = mongoose.model('PullRequestSyncMetadata', pullRequestSyncMetadata);
