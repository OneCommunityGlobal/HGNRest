const mongoose = require('mongoose');

const { Schema } = mongoose;

const InventoryItemMaterial = new Schema({
  inventoryItemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'inventoryItemType', required: true },
  project: { type: mongoose.SchemaTypes.ObjectId, ref: 'project', required: true },
  stockBought: { type: Number, required: true }, // amount bought for project, affects total stock
  stockUsed: { type: Number, required: true },
  stockAvailable: { type: Number, required: true},
  stockHeld: { type: Number, required: true },
  stockWasted: { type: Number, required: true  },
  usageRecord: [{ // daily log of amount inventory item used at job site
    date: { type: Date, required: true, default: Date.now() },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    quantityUsed: { type: Number, required: true },
  }],
  updateRecord: [{ // incident report affecting quantity/status of inventory item
    date: { type: Date, required: true, default: Date.now() },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    action: { type: String, required: true }, // ex: Add, Reduce, Hold (updates stock quantities)
    cause: { type: String, required: true }, // ex: Used, Lost, Wasted, Transfer (reason for update)
    quantity: { type: Number, required: true }, // amount of material affected
    description: { type: String, required: true, maxLength: 150 },
  }],
  purchaseRecord: [{
    date: { type: Date, required: true, default: Date.now() },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    poId: { type: String, required: true },
    sellerId: { type: String, required: true },
    quantity: { type: Number, required: true }, // adds to stockBought
    unitPrice: { type: Number, required: true },
    currency: { type: String, required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    shipping: { type: Number, required: true },
  }],
});

module.exports = mongoose.model('inventoryItemMaterial', InventoryItemMaterial, 'inventoryMaterial');
