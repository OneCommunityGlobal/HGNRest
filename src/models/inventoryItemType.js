const mongoose = require('mongoose');

const { Schema } = mongoose;

// const InventoryItemType = new Schema({
//   name: { type: String, required: true },
//   description: { type: String },
//   imageUrl: { type: String },
//   quantifier: { type: String, default: 'each' },
// });

const InventoryItemType = new Schema({ // creates an item, tracks total amount in organization's stock
  type: { type: String, required: true }, // ie Material, Equipment, Tool
  name: { type: String, required: true },
  description: { type: String, required: true, maxLength: 150 },
  uom: { type: String, required: true }, // unit of measurement
  totalStock: { type: Number, required: true }, // total amount of all stock acquired
  totalAvailable: { type: Number, required: true }, // amount of item available to be checked out
  projectsUsing: [String], // ids of projects using the item
  imageUrl: { type: String }
});

module.exports = mongoose.model('inventoryItemType', InventoryItemType, 'inventoryItemType');


