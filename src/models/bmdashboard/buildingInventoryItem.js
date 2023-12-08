const mongoose = require('mongoose');

//----------------------
// BASE INVENTORY SCHEMA
//----------------------

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

//-----------------
// MATERIALS SCHEMA
//-----------------

// inherits all properties of baseInv schema using discriminator
// each document derived from this schema includes key field { __t: "material" }
// ex: sand, stone, bricks, lumber, insulation

const buildingMaterial = baseInv.discriminator('material', new mongoose.Schema({
  stockBought: { type: Number, default: 0 }, // total amount of item bought for use in the project
  stockUsed: { type: Number, default: 0 }, // stock that has been used up and cannot be reused
  stockWasted: { type: Number, default: 0 }, // ruined or destroyed stock
  stockAvailable: { type: Number, default: 0 }, // available = bought - (used + wasted/destroyed)
  updateRecord: [{
    _id: false,
    date: { type: Date, required: true },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantityUsed: { type: Number, required: true },
    quantityWasted: { type: Number, required: true },
  }],
}));

//-----------------
// REUSABLES SCHEMA
//-----------------

// inherits all properties of baseInv schema using discriminator
// each document derived from this schema includes key field { __t: "reusable" }
// ex: hammers, screwdrivers, mallets, brushes, gloves

const buildingReusable = baseInv.discriminator('reusable', new mongoose.Schema({
  stockBought: { type: Number, default: 0 },
  stockDestroyed: { type: Number, default: 0 },
  stockAvailable: { type: Number, default: 0 },
  updateRecord: [{
    _id: false,
    date: { type: Date, required: true },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantityUsed: { type: Number, required: true },
    quantityDestroyed: { type: Number, required: true },
  }],
}));

//-----------------
// CONSUMABLES SCHEMA
//-----------------

// inherits all properties of baseInv schema using discriminator
// each document derived from this schema includes key field { __t: "consumable" }
// ex: screws, nails, staples

//-------------
// TOOLS SCHEMA
//-------------

// inherits all properties of baseInv schema using discriminator
// each document derived from this schema includes key field { __t: "tool" }
// ex: power drills, wheelbarrows, shovels

// const buildingTool = baseInv.discriminator('tool', new mongoose.Schema({

// }));


module.exports = {
  buildingMaterial,
  buildingReusable,
};
