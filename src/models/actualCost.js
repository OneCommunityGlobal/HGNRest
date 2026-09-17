const mongoose = require('mongoose');

const { Schema } = mongoose;

const actualCostSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.Mixed, // Accept both ObjectId and String
      ref: 'project',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
      enum: ['Plumbing', 'Electrical', 'Structural', 'Mechanical'],
      required: true,
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
    // Timestamps are automatically managed by Mongoose
    // createdAt and updatedAt are added automatically with timestamps: true
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  },
);

// Create compound index for efficient querying
actualCostSchema.index({ projectId: 1, date: 1, category: 1 });

// Explicitly set collection name to match database
module.exports = mongoose.model('ActualCost', actualCostSchema, 'actualcosts');
