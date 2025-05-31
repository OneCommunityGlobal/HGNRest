const mongoose = require('mongoose');

const { Schema } = mongoose;

const trendSchema = new Schema({
  value: {
    type: Number,
    default: 0
  },
  period: {
    type: String,
    enum: ['day', 'week', 'month'],
    default: 'week'
  }
}, { _id: false });

const metricSchema = new Schema({
  value: {
    type: Number,
    default: 0
  },
  trend: {
    type: trendSchema,
    default: () => ({})
  }
}, { _id: false });

const dashboardMetricsSchema = new Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    // Add a field to identify snapshot type
    snapshotType: {
      type: String,
      enum: ['weekly', 'monthly', 'current'],
      default: 'current'
    },
    metrics: {
      totalProjects: {
        type: metricSchema,
        default: () => ({})
      },
      completedProjects: {
        type: metricSchema,
        default: () => ({})
      },
      delayedProjects: {
        type: metricSchema,
        default: () => ({})
      },
      activeProjects: {
        type: metricSchema,
        default: () => ({})
      },
      avgProjectDuration: {
        type: metricSchema,
        default: () => ({})
      },
      totalMaterialCost: {
        type: metricSchema,
        default: () => ({})
      },
      totalLaborCost: {
        type: metricSchema,
        default: () => ({})
      },
      totalMaterialUsed: {
        type: metricSchema,
        default: () => ({})
      },
      materialWasted: {
        type: metricSchema,
        default: () => ({})
      },
      materialAvailable: {
        type: metricSchema,
        default: () => ({})
      },
      materialUsed: {
        type: metricSchema,
        default: () => ({})
      },
      totalLaborHours: {
        type: metricSchema,
        default: () => ({})
      }
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DashboardMetrics', dashboardMetricsSchema, 'dashboardMetrics');