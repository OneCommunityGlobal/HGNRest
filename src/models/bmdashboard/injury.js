const mongoose = require('mongoose');

const injurySchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'buildingProject',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  injuryType: {
    type: String,
    required: true,
    enum: ['Cut', 'Burn', 'Fall', 'Strain', 'Fracture', 'Bruise', 'Other']
  },
  department: {
    type: String,
    required: true,
    enum: ['Plumbing', 'Electrical', 'Structural', 'Mechanical', 'General']
  },
  severity: {
    type: String,
    required: true,
    enum: ['Minor', 'Moderate', 'Severe', 'Critical']
  },
  description: {
    type: String
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'userProfile'
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'userProfile'
  },
  treatmentRequired: {
    type: Boolean,
    default: false
  },
  daysLost: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
injurySchema.index({ projectId: 1, date: 1 });
injurySchema.index({ injuryType: 1 });
injurySchema.index({ department: 1 });
injurySchema.index({ severity: 1 });

module.exports = mongoose.model('injury', injurySchema);