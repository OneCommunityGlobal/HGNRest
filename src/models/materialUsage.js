const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * This schema represents the raw data for material transactions.
 * The API will aggregate data from this collection.
 */
const materialUsageSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project', // Assuming you have a 'Project' collection
      required: true,
    },
    projectName: {
      type: String,
      required: true,
    },
    materialId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    materialName: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true, // Index for faster date-range queries
    },
    receivedQty: {
      type: Number,
      required: true,
      default: 0,
    },
    usedQty: {
      type: Number,
      required: true,
      default: 0,
    },
    // Optional: wastedQty, if you split 'unused' vs 'wasted' later
    // wastedQty: {
    //   type: Number,
    //   required: true,
    //   default: 0,
    // }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  },
);

// Create a compound index for common queries
materialUsageSchema.index({ projectId: 1, date: 1 });

module.exports = mongoose.model('MaterialUsage', materialUsageSchema, 'materialusages');
