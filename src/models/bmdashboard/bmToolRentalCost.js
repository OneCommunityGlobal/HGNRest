const mongoose = require('mongoose');

const { Schema } = mongoose;

const toolsRentalUsageCostSchema = new Schema(
  {
    projectId: { type: mongoose.Types.ObjectId, required: true },
    projectName: { type: String, required: true },
    toolName: { type: String, required: true },
    cost: { type: Number, required: true },
    isRented: { type: Boolean, required: true },
    date: { type: Date, required: true },
  },
  { collection: 'toolRentalUsageCost' },
);

module.exports = mongoose.model('toolRentalUsageCost', toolsRentalUsageCostSchema);
