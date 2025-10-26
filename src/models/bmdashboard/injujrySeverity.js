const mongoose = require('mongoose');

const { Schema } = mongoose;

const injurySeverity = new Schema({
  projectId: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingProject', required: true },
  projectName: { type: String, required: false },
  date: { type: Date, required: true },
  injuryType: { type: String, required: true },
  department: { type: String, required: true },
  severity: { type: String, required: true, enum: ['Minor', 'Major', 'Critical'] },
  count: { type: Number, required: true, default: 1 },
});

module.exports = mongoose.model('injurySeverity', injurySeverity, 'injurySeverity');
