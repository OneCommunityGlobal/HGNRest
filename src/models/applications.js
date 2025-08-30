const { Schema, model } = require('mongoose');

const applicationSchema = new Schema(
  {
    country: { type: String, required: true },
    role: { type: String, required: true },
    timestamp: { type: Date, required: true, index: true },
    numberOfApplicants: { type: Number, required: true, default: 1 },
  },
  { timestamps: true },
);

module.exports = model('Application', applicationSchema);
