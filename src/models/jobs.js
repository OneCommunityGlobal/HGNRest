const mongoose = require('mongoose');

const { Schema } = mongoose;

const jobSchema = new Schema({
  title: { type: String, required: true }, // Job title
  category: { type: String, required: true }, // General category (e.g., Engineering, Marketing)
  description: { type: String, required: true }, // Detailed job description
  //  about: { type: String, required: true }, // Detailed about section
  requirements: { type: String, required: true }, // Detailed requirements section
  // skills: { type: String, required: true }, // Detailed skills section
  projects: { type: String, required: true }, // list of projects seperated by comma
  // whoareyou: { type: String, required: true }, // Detailed who are you section
  ourCommunity: { type: String, required: true }, // Detailed who we are section
  // whoweare: { type: String, required: true }, // Detailed who we are section
  imageUrl: { type: String, required: true }, // URL of the job-related image
  location: { type: String, required: true }, // Job location (optional for remote jobs)
  applyLink: { type: String, required: true }, // URL for the application form
  featured: { type: Boolean, default: false }, // Whether the job should be featured prominently
  datePosted: { type: Date, default: Date.now }, // Date the job was posted
  jobDetailsLink: { type: String, required: true }, // Specific job details URL
  displayOrder: { type: Number, default: 0 }, // Order for displaying jobs on the landing page
});

jobSchema.pre('validate', function (next) {
  if (!this.jobDetailsLink) {
    const baseFrontendUrl =
      `${process.env.BASE_FRONTEND_URL}/jobDetailsLink` || 'http://localhost:5173/jobDetailsLink';
    console.log(`baseFrontendUrl: ${baseFrontendUrl}`);
    this.jobDetailsLink = `${baseFrontendUrl}/${this._id}`;
    console.log(`this.jobDetailsLink: ${this.jobDetailsLink}`);
    console.log(`baseFrontendUrl: ${baseFrontendUrl}`);
    console.log(`this.jobDetailsLink: ${this.jobDetailsLink}`);
  }
  next();
});
module.exports = mongoose.model('Job', jobSchema);
