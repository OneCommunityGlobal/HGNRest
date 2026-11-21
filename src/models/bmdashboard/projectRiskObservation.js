// v1.0.0
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  profileId: { type: mongoose.SchemaTypes.ObjectId, required: true, ref: 'projectRiskProfile' },
  date: { type: Date, required: true },
  recordedAt: { type: Date, required: true },
  predictedCostOverrun: { type: Number, default: null },
  predictedTimeDelay: { type: Number, default: null },
  totalOpenIssues: { type: Number, default: null },
});
schema.index({ profileId: 1, date: 1 }, { unique: true });
module.exports = mongoose.model('projectRiskObservation', schema);
