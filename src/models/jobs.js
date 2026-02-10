const mongoose = require('mongoose');

const { Schema } = mongoose;

const jobSchema = new Schema({
  title: { type: String, required: true }, // Job title
  category: { type: String, required: true }, // General category (e.g., Engineering, Marketing)
  description: { type: String, required: true }, // Detailed job description
  imageUrl: { type: String, required: true }, // URL of the job-related image
  location: { type: String, required: true }, // Job location (optional for remote jobs)
  applyLink: { type: String, required: true }, // URL for the application form
  featured: { type: Boolean, default: false }, // Whether the job should be featured prominently
  datePosted: { type: Date, default: Date.now }, // Date the job was posted
  jobDetailsLink: { type: String, required: true }, // Specific job details URL
  displayOrder: { type: Number, default: 0 }, // Order for displaying jobs on the landing page
});

module.exports = mongoose.model('Job', jobSchema);
