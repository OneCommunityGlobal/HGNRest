const mongoose = require('mongoose');

const jobHitsAndApplicationsSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  hit: {
    type: Boolean,
    required: true,
  },
  applied: {
    type: Boolean,
    required: true,
  },
});

jobHitsAndApplicationsSchema.index({ role: 1, date: 1 });

module.exports = mongoose.model('JobHitsAndApplications', jobHitsAndApplicationsSchema);
