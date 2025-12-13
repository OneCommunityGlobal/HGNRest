const mongoose = require('mongoose');

const rentalChartSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  toolName: {
    type: String,
    required: true,
  },
  rentalCost: {
    type: Number,
    required: true,
  },
  totalMaterialCost: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model('RentalChart', rentalChartSchema, 'rentalChart');
