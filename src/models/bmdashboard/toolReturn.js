const mongoose = require('mongoose');

const toolReturnSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  toolName: { type: String, required: true },
  rentalCost: { type: Number, required: true },
  totalMaterialCost: { type: Number, required: true },
  returnedLate: { type: Number, required: true },
  totalReturns: { type: Number, required: true },
  date: { type: Date, required: true },
});

const ToolReturn = mongoose.model('ToolReturn', toolReturnSchema, 'toolreturns');

module.exports = ToolReturn;
