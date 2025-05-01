const mongoose = require('mongoose');

const projectCostPredictionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  plannedCost: {
    type: Number,
    required: true
  },
  actualCost: {
    type: Number,
    required: true
  }
});

const ProjectCostPrediction = mongoose.model('ProjectCostPrediction', projectCostPredictionSchema);

module.exports = ProjectCostPrediction;