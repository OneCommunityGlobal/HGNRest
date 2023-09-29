const mongoose = require('mongoose')

const {Schema} = mongoose

const InventoryMaterial = new Schema({
  inventoryItemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'inventoryItemType', required: true },
  projectId: {type: Number, required: true },
  stockBought: { type: Number, required: true }, // amount bought for project, affects total stock
  stockUsed: { type: Number, required: true },
  stockAvailable: { type: Number, required: true },
  stockHeld: { type: Number, required: true },
  stockWasted: { type: Number, required: true },
  usageRecord: [{ // daily log of amount inventory item used at job site
    date: { type: Date, required: true, default: Date.now() },
    createdBy: {type: String, required: true },
    taskId: { type: String, required: true },
    quantityUsed: { type: Number, required: true },
    responsibleUserId: { type: String, required: true }
  }],
  updateRecord: [{ // incident report affecting quantity/status of inventory item
    date: { type: Date, required: true, default: Date.now() },
    createdBy: {type: String, required: true },
    action: { type: String, required: true }, // ex: Add, Reduce, Hold
    cause: { type: String, required: true }, // ex: Used, Lost, Wasted, Transfer
    quantity: { type: Number, required: true },
    description: { type: String, required: true, maxLength: 150 },
    responsibleUserId: { type: String, required: true },
    imageUrl: { type: String }
  }],
  purchaseRecord: [{
    date: { type: Date, required: true, default: Date.now() },
    createdBy: {type: String, required: true },
    invoiceId: { type: String, required: true },
    vendor: { type: String, required: true },
    brand: { type: String, required: true },
    amount: { type: Number, required: true }, // amount of item in each unit
    quantity: { type: Number, required: true }, // number of units purchased
    unitCost: { type: Number, required: true },
    tax: { type: Number, required: true },
    shipping: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    imageUrl: { type: String },
  }]
})

module.exports = mongoose.model('inventoryMaterial', InventoryMaterial, 'inventoryMaterial');
