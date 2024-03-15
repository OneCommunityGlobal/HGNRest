const mongoose = require('mongoose');

//-----------------------
// BASE INVENTORY SCHEMAS
//-----------------------

// TODO: purchaseRecord subdocs may be changed to purchaseRequests. A new purchaseRecord subdoc may be added to track purchases and costs for the item.

// SMALL ITEMS BASE
// base schema for Consumable, Material, Reusable
// documents stored in 'buildingInventoryItems' collection

const smallItemBaseSchema = mongoose.Schema({
  itemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'invTypeBase' },
  project: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingProject' },
  stockBought: { type: Number, default: 0 }, // total amount of item bought for use in the project
  // TODO: can stockAvailable default be a function?
  stockAvailable: { type: Number, default: 0 }, // available = bought - (used + wasted/destroyed)
  purchaseRecord: [{
    date: { type: Date, default: Date.now() },
    requestedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantity: { type: Number, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
    brandPref: String,
    status: { type: String, default: 'Pending', enum: ['Approved', 'Pending', 'Rejected'] },
  }],
  updateRecord: [{
    date: { type: Date, required: true },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantityUsed: { type: Number, required: true },
    quantityWasted: { type: Number, required: true },
  }],
});

const smallItemBase = mongoose.model('smallItemBase', smallItemBaseSchema, 'buildingInventoryItems');

// LARGE ITEMS BASE
// base schema for Tool, Equipment
// documents stored in 'buildingInventoryItems' collection

const largeItemBaseSchema = mongoose.Schema({
  itemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'invTypeBase' },
  project: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingProject' },
  // actual purchases (once there is a system) may need their own subdoc
  // subdoc may contain below purchaseStatus and rental fields
  // for now they have default dummy values
  purchaseStatus: { type: String, enum: ['Rental', 'Purchase'], default: 'Rental' },
  // TODO: rental fields should be required if purchaseStatus === "Rental"
  rentedOnDate: { type: Date, default: Date.now() },
  rentalDueDate: { type: Date, default: new Date(Date.now() + (3600 * 1000 * 24 * 14)) },
  // image of actual tool (remove default once there is a system for this)
  imageUrl: { type: String, default: 'https://ik.imagekit.io/tuc2020/wp-content/uploads/2021/01/HW2927.jpg' },
  // this can be updated to purchaseRequestRecord
  // some fields (i.e. status) may be transferred to purchaseRecord when it is added
  purchaseRecord: [{
    date: { type: Date, default: Date.now() },
    requestedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantity: { type: Number, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
    makeModelPref: String,
    estUsageTime: { type: String, required: true },
    usageDesc: { type: String, required: true, maxLength: 150 },
    status: { type: String, default: 'Pending', enum: ['Approved', 'Pending', 'Rejected'] },
  }],
  updateRecord: [{ // track tool condition updates
      date: { type: Date, default: Date.now() },
      createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      condition: { type: String, enum: ['Good', 'Needs Repair', 'Out of Order'] },
  }],
  logRecord: [{ // track tool daily check in/out and responsible user
      date: { type: Date, default: Date.now() },
      createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      responsibleUser: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      type: { type: String, enum: ['Check In', 'Check Out'] },
  }],
  userResponsible: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' }, //new field
});

const largeItemBase = mongoose.model('largeItemBase', largeItemBaseSchema, 'buildingInventoryItems');

//-----------------
// MATERIALS SCHEMA
//-----------------

// inherits all properties of smallItemBaseSchema
// each document derived from this schema includes key field { __t: "material" }
// ex: sand, stone, bricks, lumber, insulation

const buildingMaterial = smallItemBase.discriminator('material_item', new mongoose.Schema({
  stockUsed: { type: Number, default: 0 }, // stock that has been used up and cannot be reused
  stockWasted: { type: Number, default: 0 }, // ruined or destroyed stock
}));

//------------------
// CONSUMABLE SCHEMA
//------------------

// inherits all properties of smallItemBaseSchema
// each document derived from this schema includes key field { __t: "consumable" }
// ex: screws, nails, staples

const buildingConsumable = smallItemBase.discriminator('consumable_item', new mongoose.Schema({
  stockUsed: { type: Number, default: 0 }, // stock that has been used up and cannot be reused
  stockWasted: { type: Number, default: 0 }, // ruined or destroyed stock
}));

//----------------
// REUSABLE SCHEMA
//----------------

// inherits all properties of smallItemBaseSchema
// each document derived from this schema includes key field { __t: "reusable" }
// ex: hammers, screwdrivers, mallets, brushes, gloves

const buildingReusable = smallItemBase.discriminator('reusable_item', new mongoose.Schema({
  stockDestroyed: { type: Number, default: 0 },
}));

//------------
// TOOL SCHEMA
//------------

// inherits all properties of largeItemBaseSchema
// each document derived from this schema includes key field { __t: "tool" }
// ex: power drills, wheelbarrows, shovels, jackhammers

const buildingTool = largeItemBase.discriminator('tool_item', new mongoose.Schema({
  // TODO: add function to create simple numeric code for on-site tool tracking
  code: { type: String, default: '001' },
}));

//-----------------
// EQUIPMENT SCHEMA
//-----------------

// inherits all properties of largeItemBaseSchema
// each document derived from this schema includes key field { __t: "equipment" }
// items in this category are assumed to be rented
// ex: tractors, excavators, bulldozers

const buildingEquipment = largeItemBase.discriminator('equipment_item', new mongoose.Schema({
  isTracked: { type: Boolean, required: true }, // has asset tracker
  assetTracker: { type: String, required: () => this.isTracked }, // required if isTracked = true (syntax?)
}));

module.exports = {
  buildingMaterial,
  buildingConsumable,
  buildingReusable,
  buildingTool,
  buildingEquipment,
};
