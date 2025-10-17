const mongoose = require('mongoose');

const { Schema } = mongoose;

const projectStatusSchema = new Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Delayed'],
      required: true,
    },
    startDate: { type: Date, required: true },
    completionDate: { type: Date },
  },
  { timestamps: true },
);

// Indexes for faster queries
projectStatusSchema.index({ status: 1 });
projectStatusSchema.index({ startDate: 1 });

module.exports = mongoose.model('ProjectStatus', projectStatusSchema, 'projectStatus');
