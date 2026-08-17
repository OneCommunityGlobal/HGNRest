const mongoose = require('mongoose');

const injurySeveritySchema = new mongoose.Schema(
  {
    count: { type: Number, required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    projectName: { type: String },
    date: { type: Date, required: true },
    injuryType: { type: String },
    department: { type: String },
    severity: { type: String },
  },
  { collection: 'injuries' },
);

module.exports = mongoose.model('InjurySeverity', injurySeveritySchema);
