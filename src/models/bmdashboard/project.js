const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: { type: String, enum: ['active', 'completed', 'delayed'], required: true },
    start_date: { type: Date },
    completion_date: { type: Date },
  },
  { timestamps: true },
);

projectSchema.index({ status: 1 });
projectSchema.index({ start_date: 1 });

module.exports = mongoose.model('Project', projectSchema);
