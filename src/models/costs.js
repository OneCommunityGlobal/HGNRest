const mongoose = require('mongoose');

const { Schema } = mongoose;

const COST_CATEGORIES = [
  'Total Cost of Labor',
  'Total Cost of Materials',
  'Total Cost of Equipment',
];

const DEFAULT_HOURLY_RATE = 25;

const costSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'buildingProject',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: COST_CATEGORIES,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    costDate: {
      type: Date,
      required: true,
      index: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    projectType: {
      type: String,
      enum: ['commercial', 'residential', 'private'],
      default: 'private',
      index: true,
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      enum: ['aggregation', 'manual', 'correction'],
      default: 'aggregation',
    },
  },
  { timestamps: true },
);

costSchema.index({ projectId: 1, category: 1, costDate: 1 }, { unique: true });
costSchema.index({ projectId: 1, costDate: 1 });
costSchema.index({ costDate: 1 });

const Cost = mongoose.model('Cost', costSchema);

module.exports = Cost;
module.exports.COST_CATEGORIES = COST_CATEGORIES;
module.exports.DEFAULT_HOURLY_RATE = DEFAULT_HOURLY_RATE;
