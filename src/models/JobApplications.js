const mongoose = require('mongoose');

const jobApplicationsViewsSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    views: { type: Number, required: true, min: 0 },
    applications: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
  },
  { collection: 'JobApplicationsViews' },
);

module.exports = mongoose.model('JobApplicationsViews', jobApplicationsViewsSchema);
