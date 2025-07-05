const mongoose = require('mongoose');
// Candidate ID
// Role
// OPT Status (Categorical: OPT started, CPT not eligible, etc.)
// Application Date

const applicantSchema = new mongoose.Schema({
  candidatId: { type: Number, required: true },
  role: { type: String, required: true },
  optStatus: {
    type: String,
    enum: ['OPT started', 'CPT not eligible', 'Citizen', 'OPT not yet started', 'N/A'],
  },
  applicationDate: { type: Date, required: true },
});

module.exports = mongoose.model('applicantsJobStatus', applicantSchema);
