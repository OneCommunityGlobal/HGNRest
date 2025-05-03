const mongoose = require('mongoose');

const costEntrySchema = new mongoose.Schema({
  month: {
    type: String,
    required: true
  },
  plannedCost: {
    type: Number
  },
  actualCost: {
    type: Number
  },
  predictedCost: {
    type: Number
  }
});

const projectCostSchema = new mongoose.Schema({
  projectId: {
    type: Number,
    required: true,
    unique: true
  },
  costs: [costEntrySchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const ProjectCost = mongoose.model('ProjectCost', projectCostSchema);

module.exports = ProjectCost;