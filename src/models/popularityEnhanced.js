// src/models/popularityEnhanced.js
const mongoose = require('mongoose');

/**
 * Enhanced Popularity Timeline Model
 * Description: Enhanced schema for role-based popularity analytics with improved indexing
 */
const PopularityEnhancedSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: true,
      index: true,
    },
    hitsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    applicationsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    role: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // Enhanced fields for better analytics
    roleCategory: {
      type: String,
      default() {
        return this.role;
      },
      index: true,
    },
    dataSource: {
      type: String,
      default: 'job_posting',
      enum: ['job_posting', 'profile_view', 'other'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: 'popularityTimelineEnhanced',
    timestamps: true,
  },
);

// Compound indexes for optimized queries
PopularityEnhancedSchema.index({ timestamp: 1, role: 1 });
PopularityEnhancedSchema.index({ role: 1, month: 1 });
PopularityEnhancedSchema.index({ roleCategory: 1, timestamp: 1 });
PopularityEnhancedSchema.index({ month: 1, role: 1, isActive: 1 });

module.exports = mongoose.model('PopularityEnhanced', PopularityEnhancedSchema);
