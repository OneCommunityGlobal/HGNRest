const mongoose = require('mongoose');

const applicantSchema = new mongoose.Schema({
  experience: { type: Number, required: true },
  source: { type: String },
  roles: [String],
  startDate: Date,
  endDate: Date,
});

module.exports = mongoose.model('Applicant', applicantSchema, 'jobapplicants');
