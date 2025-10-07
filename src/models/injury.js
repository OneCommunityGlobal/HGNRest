const mongoose = require('mongoose');

const injurySchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: false, // keep optional for now
    },
    injuryType: {
      type: String,
      required: true,
      enum: ['Slip/Trip/Fall', 'Equipment', 'Ergonomics', 'Other'],
    },
    severity: {
      type: String,
      required: true,
      enum: ['Minor', 'Moderate', 'Severe', 'Critical'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'injuries' },
);

module.exports = mongoose.model('Injury', injurySchema);
