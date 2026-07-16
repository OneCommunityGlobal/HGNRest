const mongoose = require('mongoose');

const { Schema } = mongoose;

const pullRequest = new Schema(
  {
    // PR Number is FE-PRNumber and BE-PRNumber
    prNumber: { type: String, unique: true },
    prTitle: String,
    prRepo: String,
    prCreatedAt: Date,
  },
  { timestamps: true },
);

pullRequest.index({ prNumber: 1 });
pullRequest.index({ prCreatedAt: 1 });

module.exports = mongoose.model('PullRequest', pullRequest);
