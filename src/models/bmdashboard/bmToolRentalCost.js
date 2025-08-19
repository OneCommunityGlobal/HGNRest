const mongoose = require('mongoose');

const { Schema } = mongoose;

const toolRentalUsageCost = new Schema({
  projectId: { type: mongoose.Types.ObjectId, required: true },
  projectName: { type: String, required: true },
  toolName: { type: String, required: true },
  cost: { type: Number, required: true },
  isRented: { type: Boolean, required: true },
  date: { type: Date, required: true },
});

module.exports = mongoose.model('toolRentalUsageCost', toolRentalUsageCost, 'toolRentalUsageCosts');
