const mongoose = require('mongoose');

const injuryCategorySchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'buildingProject' },
  projectName: String,
  date: Date,
  injuryType: String,
  workerCategory: String,
  severity: String,
  count: Number,
});

module.exports = mongoose.model('InjuryCategory', injuryCategorySchema);