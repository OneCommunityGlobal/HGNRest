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
    _id: false, // do not add _id field to subdocument
    date: { type: Date, default: Date.now() },
    requestedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantity: { type: Number, required: true, default: 1 }, // default 1 for tool or equipment purchases
    priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
    brandPref: String,
    status: { type: String, default: 'Pending', enum: ['Approved', 'Pending', 'Rejected'] },
  }],
  updateRecord: [{
    _id: false,
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
  itemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingInventoryType' },
  project: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingProject' },
  purchaseStatus: { type: String, enum: ['Rental', 'Purchase'], required: true },
  // rental fields are required if purchaseStatus = "Rental" (hopefully correct syntax)
  rentedOnDate: { type: Date, required: () => this.purchaseStatus === 'Rental' },
  rentalDueDate: { type: Date, required: () => this.purchaseStatus === 'Rental' },
  imageUrl: String,
  purchaseRecord: [{
    _id: false, // do not add _id field to subdocument
    date: { type: Date, default: Date.now() },
    requestedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
    makeModelPref: String,
    estTimeRequired: { type: Number, required: true }, // estimated time required on site
    status: { type: String, default: 'Pending', enum: ['Approved', 'Pending', 'Rejected'] },
  }],
  updateRecord: [{ // track tool condition updates
      _id: false,
      date: { type: Date, default: Date.now() },
      createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      condition: { type: String, enum: ['Good', 'Needs Repair', 'Out of Order'] },
  }],
  logRecord: [{ // track tool daily check in/out and responsible user
      _id: false,
      date: { type: Date, default: Date.now() },
      createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      responsibleUser: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      type: { type: String, enum: ['Check In', 'Check Out'] },
  }],
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
  code: { type: Number, required: true }, // TODO: add function to create simple numeric code for on-site tool tracking
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
