const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: String,
    status: { type: String, enum: ['active', 'completed', 'delayed'] },
    start_date: Date,
    completion_date: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model('Project', projectSchema);
