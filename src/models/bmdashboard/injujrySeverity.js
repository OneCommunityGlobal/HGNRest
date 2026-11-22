const mongoose = require('mongoose');

const { Schema } = mongoose;

const injurySeverity = new Schema({
  projectId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'buildingProject',
    required: true,
  },
  projectName: {
    type: String,
    required: false,
  },
  date: {
    type: Date,
    required: true,
  },
  injuryType: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  workerCategory: {
    type: String,
    required: false,
    trim: true,
    maxlength: 100,
  },
  department: {
    type: String,
    required: true,
    trim: true,
  },
  severity: {
    type: String,
    required: true,
    enum: ['Minor', 'Major', 'Critical'],
  },
  description: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500,
  },
  count: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
  },
});

module.exports = mongoose.model('injurySeverity', injurySeverity, 'injurySeverity');
