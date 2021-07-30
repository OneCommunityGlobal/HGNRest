const mongoose = require('mongoose');

const { Schema } = mongoose;

const InventoryItemType = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String },
  quantifier: { type: String, default: 'each' },
});

module.exports = mongoose.model('inventoryItemType', InventoryItemType, 'inventoryItemType');
