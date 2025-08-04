const mongoose = require('mongoose');

const materialLossModel = new mongoose.Schema({
  materialId: { type: String, required: true, index: true },
  materialName: { type: String, required: true },
  year: { type: Number, required: true, index: true },
  month: { type: String, required: true, index: true },
  lossPercentage: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now, required: true}
});

materialLossModel.index({ materialId: 1, year: 1, month: 1 });

module.exports = mongoose.model('MaterialLoss', materialLossModel, 'materialLoss');
