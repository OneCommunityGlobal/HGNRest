const mongoose = require('mongoose');

// base schema for all categories of inventory (Consumable, Material, Reusable, Tool, Equipment)
// this schema is extended by the individual schemas for each inventory type
// all documents derived from this schema are saved to the collection 'buildingInventoryItems'

const baseInvSchema = mongoose.Schema({
  itemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingInventoryType' },
  project: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingProject' },
  purchaseRecord: [{
    _id: false, // do not add _id field to subdocument
    date: { type: Date, default: Date.now() },
    requestedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantity: { type: Number, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
    brandPref: String,
    status: { type: String, default: 'Pending', enum: ['Approved', 'Pending', 'Rejected'] },
  }],
});

const baseInv = mongoose.model('buildingInventory', baseInvSchema, 'buildingInventoryItems');

module.exports = baseInv;
