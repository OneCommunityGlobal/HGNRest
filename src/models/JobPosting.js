const mongoose = require('mongoose');

const jobPostingSchema = new mongoose.Schema(
  {
    title: String,
    hits: Number,
    applications: Number,
    datePosted: Date,
    // other fields...
  },
  { collection: 'JobPosting' },
);

module.exports = mongoose.model('JobPosting', jobPostingSchema);
