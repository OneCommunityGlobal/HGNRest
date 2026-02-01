const mongoose = require('mongoose');

const injuryCategorySchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'buildingProject', required: true },
  projectName: { type: String, trim: true },
  date: { type: Date, required: true },
  injuryType: { type: String, trim: true },
  workerCategory: { type: String, trim: true },
  severity: { type: String, trim: true },
  count: { type: Number, default: 1, min: 0 },
});

injuryCategorySchema.index({ projectId: 1, date: 1 });
injuryCategorySchema.index({ projectName: 1 });
injuryCategorySchema.index({ severity: 1 });
injuryCategorySchema.index({ injuryType: 1 });
injuryCategorySchema.index({ workerCategory: 1 });

module.exports = mongoose.model('InjuryCategory', injuryCategorySchema);