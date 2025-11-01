const mongoose = require('mongoose');

const { Schema } = mongoose;

const resourceRequestSchema = new Schema(
  {
    educator_id: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'userProfile',
      required: true,
    },
    pm_id: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'userProfile',
      required: false, // nullable
      default: null,
    },
    request_title: {
      type: String,
      required: true,
    },
    request_details: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied'],
      default: 'pending',
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes for better query performance
resourceRequestSchema.index({ educator_id: 1 });
resourceRequestSchema.index({ pm_id: 1 });
resourceRequestSchema.index({ status: 1 });
resourceRequestSchema.index({ createdAt: 1 });

module.exports = mongoose.model('resourceRequest', resourceRequestSchema, 'ResourceRequests');
