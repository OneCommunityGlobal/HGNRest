const mongoose = require('mongoose');

const jobPostingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    applications: {
      type: Number,
      required: true,
    },
    hits: {
      type: Number,
      required: false,
    },
    datePosted: {
      type: Date,
      required: true,
    },
  },
  { collection: 'JobPosting' },
);

module.exports = mongoose.model('JobPosting', jobPostingSchema);
