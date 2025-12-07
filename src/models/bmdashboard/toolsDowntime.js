const mongoose = require('mongoose');

const toolsDowntimeSchema = new mongoose.Schema(
  {
    toolId: {
      type: String,
      required: true,
      trim: true,
    },
    toolName: {
      type: String,
      required: true,
      trim: true,
    },
    projectId: {
      type: String,
      required: true,
      trim: true,
    },
    utilizationRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    downtimeHours: {
      type: Number,
      required: true,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Create indexes for better query performance
toolsDowntimeSchema.index({ toolId: 1 });
toolsDowntimeSchema.index({ projectId: 1 });
toolsDowntimeSchema.index({ createdAt: -1 });
toolsDowntimeSchema.index({ startDate: -1 });
toolsDowntimeSchema.index({ endDate: -1 });

// Compound indexes for common query patterns
toolsDowntimeSchema.index({ projectId: 1, toolId: 1 }); // For project-specific tool queries
toolsDowntimeSchema.index({ projectId: 1, startDate: -1 }); // For project data sorted by start date
toolsDowntimeSchema.index({ toolId: 1, startDate: -1 }); // For tool history sorted by start date
toolsDowntimeSchema.index({ startDate: 1, endDate: 1 }); // For date range queries

// Sparse index for optional fields (if you add them later)
// toolsDowntimeSchema.index({ status: 1 }, { sparse: true });

module.exports = mongoose.model('ToolsDowntime', toolsDowntimeSchema);
