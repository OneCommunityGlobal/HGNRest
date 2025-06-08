const mongoose = require('mongoose');

const { Schema } = mongoose;

const toolsNeededReplacementSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'buildingProject',
      required: true,
    },
    toolName: {
      type: String,
      required: true,
    },
    requirementSatisfiedPercentage: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'toolsNeededReplacement' },
);

module.exports = mongoose.model('toolsNeededReplacement', toolsNeededReplacementSchema);