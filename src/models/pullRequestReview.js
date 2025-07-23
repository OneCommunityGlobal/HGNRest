const mongoose = require('mongoose');

const { Schema } = mongoose;

const pullRequestReview = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    prNumber: Number,
    submitedAt: Date,
  },
  { timestamps: true },
);

// Indexes for efficient querying
pullRequestReview.index({ submittedAt: 1 });
pullRequestReview.index({ prNumber: 1 });
pullRequestReview.index({ id: 1 }, { unique: true });

module.exports = mongoose.model('PullRequestReview', pullRequestReview);
