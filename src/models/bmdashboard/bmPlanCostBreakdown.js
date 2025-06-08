// src/models/bmdashboard/bmPlanCostBreakdown.js
const mongoose = require('mongoose');

const costSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  category: {
    type: String,
    enum: ['Plumbing', 'Electrical', 'Structural', 'Mechanical'],
    required: true,
  },
  plannedCost: { type: Number, required: true },
});

module.exports = mongoose.model('bmPlanCostBreakdown', costSchema);
