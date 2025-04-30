const mongoose = require('mongoose');

const jobPostingSchema = new mongoose.Schema({
  title: String,
  hits: Number,
  applications: Number,
  datePosted: Date,
});

module.exports = mongoose.model('JobPosting', jobPostingSchema);
