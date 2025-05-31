const mongoose = require('mongoose');

const applicantSchema = new mongoose.Schema({
  experience: { type: Number, required: true },
  roles: [String],
  startDate: Date,
  endDate: Date,
});

module.exports = mongoose.model('jobapplicants', applicantSchema);
