const mongoose = require('mongoose');

const { Schema } = mongoose;

const InventoryItem = new Schema({
  quantity: { type: Number, required: true },
  poNums: [{ type: String }],
  cost: { type: Number },
  costPer: { type: Number },
  notes: [{
    quantity: { type: Number },
    typeOfMovement: { type: String },
    message: { type: String },
    modified: { type: Date, required: true, default: Date.now() },
  }],
  created: { type: Date, required: true, default: Date.now() },
  inventoryItemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'inventoryItemType', required: true },
  wasted: { type: Boolean, required: true, default: false },
  project: { type: Schema.Types.ObjectId, ref: 'project', required: true },
  wbs: { type: Schema.Types.ObjectId, ref: 'wbs' },
});

module.exports = mongoose.model('inventoryItem', InventoryItem, 'inventoryItem');
