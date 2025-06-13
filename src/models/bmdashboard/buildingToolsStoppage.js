const mongoose = require('mongoose');

const { Schema } = mongoose;

const toolsStoppageReasonSchema = new Schema(
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
    usedForLifetime: {
      type: Number,
      required: true,
      min: 0,
    },
    damaged: {
      type: Number,
      required: true,
      min: 0,
    },
    lost: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'toolsStoppageReason' },
);

module.exports = mongoose.model('toolsStoppageReason', toolsStoppageReasonSchema);