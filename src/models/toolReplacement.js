const mongoose = require('mongoose');

const toolReplacementSchema = new mongoose.Schema({
  toolName: {
    type: String,
    required: true,
  },
  requirementSatisfiedPercentage: {
    type: Number,
    required: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'buildingProject',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
});

toolReplacementSchema.index({ projectId: 1, date: 1 });
toolReplacementSchema.index({ requirementSatisfiedPercentage: 1 });
toolReplacementSchema.index({ toolName: 1 });

module.exports = mongoose.model('ToolReplacement', toolReplacementSchema);
