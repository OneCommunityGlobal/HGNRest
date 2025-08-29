/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies, import/no-cycle, import/order, import/no-self-import */
const mongoose = require('mongoose');

const costBreakdownEntrySchema = new mongoose.Schema({
  month: {
    type: String,
    required: true,
  },
  plumbing: {
    type: Number,
    default: 0,
  },
  electrical: {
    type: Number,
    default: 0,
  },
  structural: {
    type: Number,
    default: 0,
  },
  mechanical: {
    type: Number,
    default: 0,
  },
});

const costBreakdownSchema = new mongoose.Schema({
  projectId: {
    type: Number,
    required: true,
  },
  costs: [costBreakdownEntrySchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure unique projectId
costBreakdownSchema.index({ projectId: 1 }, { unique: true });

const CostBreakdown = mongoose.model('CostBreakdown', costBreakdownSchema);

module.exports = CostBreakdown;
