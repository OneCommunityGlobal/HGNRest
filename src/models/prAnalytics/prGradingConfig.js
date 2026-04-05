const mongoose = require('mongoose');

const { Schema } = mongoose;

const PRGradingConfigSchema = new Schema(
  {
    teamName: { type: String, required: true, unique: true, trim: true },
    reviewerCount: { type: Number, required: true, min: 1 },
    testDataType: {
      type: String,
      enum: ['minimal', 'mixed', 'edge cases', 'custom'],
      required: true,
    },
    reviewerNames: [{ type: String, trim: true }],
    notes: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('PRGradingConfig', PRGradingConfigSchema, 'prGradingConfigs');
