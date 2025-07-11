const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  country: { type: String, required: true },
  role: { type: String, required: true },
  timestamp: { type: Date, required: true },
  numberOfApplicants: { type: Number, required: true },
});

module.exports = mongoose.model('Application', applicationSchema);
