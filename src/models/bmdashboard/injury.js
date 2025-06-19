const mongoose = require('mongoose');

const injurySchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'buildingProject',
    required: true
  },
  projectName: {
    type: String
  },
  date: {
    type: Date,
    required: true
  },
  injuryType: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    required: true
  }
});

// Indexes for better query performance
injurySchema.index({ projectId: 1, date: 1 });
injurySchema.index({ injuryType: 1 });
injurySchema.index({ department: 1 });
injurySchema.index({ severity: 1 });

module.exports = mongoose.model('Injury', injurySchema, 'injurySeverity');
