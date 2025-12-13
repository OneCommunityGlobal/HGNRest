const mongoose = require('mongoose');

const applicantSchema = new mongoose.Schema({
  experience: { type: Number, required: true },
  roles: [String],
  startDate: String,
  endDate: String,
});

module.exports = mongoose.model('Applicant', applicantSchema, 'jobapplicants');
