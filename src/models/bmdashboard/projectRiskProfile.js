// v1.0.0
const mongoose = require('mongoose');

const { Schema } = mongoose;
const finiteNumber = (value) => value == null || Number.isFinite(value);

const projectRiskProfile = new Schema({
  projectId: { type: mongoose.SchemaTypes.ObjectId, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  initialCostEstimate: {
    type: Number,
    required: true,
    min: Number.MIN_VALUE,
    validate: finiteNumber,
  },
  currentCostIncurred: { type: Number, required: false, min: 0, validate: finiteNumber },
  issues: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'Issue' }],
  plannedTime: { type: Number, min: Number.MIN_VALUE, validate: finiteNumber },
  actualTimeElapsed: { type: Number, min: 0, validate: finiteNumber },
  status: { type: String, enum: ['active', 'completed', 'unknown'], default: 'unknown' },
  completedAt: { type: Date },
  demoDataset: { type: String },
});

projectRiskProfile.pre('validate', function validateSchedule(next) {
  if (this.endDate <= this.startDate) this.invalidate('endDate', 'End must be after start');
  if (this.status === 'completed' && !this.completedAt) {
    this.invalidate('completedAt', 'Completed projects require a completion date');
  }
  if (this.completedAt && (this.completedAt < this.startDate || this.completedAt > new Date())) {
    this.invalidate('completedAt', 'Completion must be between project start and now');
  }
  next();
});

module.exports = mongoose.model('projectRiskProfile', projectRiskProfile, 'projectRiskProfiles');
