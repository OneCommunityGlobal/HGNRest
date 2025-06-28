const mongoose = require('mongoose');

const injurySeveritySchema = new mongoose.Schema({
  count: {
    type: Number,
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  projectName: {
    type: String,
    required: true
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
    enum: ['Serious', 'Medium', 'Low'],
    required: true
  }
});

module.exports = mongoose.model('injurySeverity', injurySeveritySchema, 'injurySeverity');