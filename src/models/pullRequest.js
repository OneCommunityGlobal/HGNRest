const mongoose = require('mongoose');

const { Schema } = mongoose;

const pullRequest = new Schema(
  {
    // PR Number is FE-PRNumber and BE-PRNumber
    prNumber: { type: String, unique: true },
    prTitle: String,
    prRepo: String,
  },
  { timestamps: true },
);

pullRequest.index({ prNumber: 1 });

module.export = mongoose.model('PullRequest', pullRequest);
