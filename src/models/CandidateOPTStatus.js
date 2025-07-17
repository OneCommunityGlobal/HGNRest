// alisha
const mongoose = require('mongoose');

const CandidateOPTStatusSchema = new mongoose.Schema({
  candidateId: { type: Number, required: true },
  role: { type: String, required: true },
  optStatus: {
    type: String,
    enum: ['OPT started', 'CPT not eligible', 'Citizen', 'OPT not yet started', 'N/A'],
  },
  applicationDate: { type: Date, required: true },
});

module.exports = mongoose.model('CandidateOPTStatus', CandidateOPTStatusSchema);
