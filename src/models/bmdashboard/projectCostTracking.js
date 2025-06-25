const mongoose = require('mongoose');

const { Schema } = mongoose;

const projectCostTrackingSchema = new Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Project',
  },
  date: {
    type: Date,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['Labor', 'Materials', 'Equipment'],
  },
  cost: {
    type: Number,
    required: true,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient querying
projectCostTrackingSchema.index({ projectId: 1, date: 1, category: 1 });

// Update updatedAt on save
projectCostTrackingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model(
  'ProjectCostTracking',
  projectCostTrackingSchema,
  'projectCostTracking',
);
