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
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
});

toolReplacementSchema.index({ role: 1, date: 1 });

module.exports = mongoose.model('ReplacementGraph', toolReplacementSchema);
