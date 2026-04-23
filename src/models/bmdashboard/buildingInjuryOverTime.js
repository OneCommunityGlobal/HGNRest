const mongoose = require('mongoose');

const injuryOverTimeSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'buildingProject', required: true },
  date: { type: Date, required: true },
  injuryType: { type: String, trim: true },
  department: { type: String, trim: true },
  severity: { type: String, trim: true },
  count: { type: Number, default: 1, min: 0 },
});

module.exports = mongoose.model('InjuryOverTime', injuryOverTimeSchema, 'injuryOverTime');
