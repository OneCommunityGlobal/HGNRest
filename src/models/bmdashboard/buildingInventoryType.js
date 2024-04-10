const mongoose = require('mongoose');

const { Schema } = mongoose;

//---------------------------
// BASE INVENTORY TYPE SCHEMA
//---------------------------

// all schemas will inherit these properties
// all documents will live in buildingInventoryTypes collection

const invTypeBaseSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true, maxLength: 150 },
  imageUrl: String,
  createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfiles' },
});

const invTypeBase = mongoose.model('invTypeBase', invTypeBaseSchema, 'buildingInventoryTypes');

//---------------------------
// MATERIAL TYPE
//---------------------------

// ex: sand, stone, brick, lumber

const materialType = invTypeBase.discriminator('material_type', new mongoose.Schema({
  category: { type: String, enum: ['Material'] },
  unit: { type: String, required: true }, // unit of measurement
}));

//---------------------------
// CONSUMABLE TYPE
//---------------------------

// ex: screws, nails, staples

const consumableType = invTypeBase.discriminator('consumable_type', new mongoose.Schema({
  category: { type: String, enum: ['Consumable'] },
  size: { type: String, required: true },
}));

//---------------------------
// REUSABLE TYPE
//---------------------------

// ex: gloves, brushes, hammers, screwdrivers

const reusableType = invTypeBase.discriminator('reusable_type', new mongoose.Schema({
  category: { type: String, enum: ['Reusable'] },
}));

//---------------------------
// TOOL TYPE
//---------------------------

// ex: shovels, wheelbarrows, power drills, jackhammers

const toolType = invTypeBase.discriminator('tool_type', new mongoose.Schema({
  category: { type: String, enum: ['Tool'] },
  isPowered: { type: Boolean, required: true },
  powerSource: { type: String, required: () => this.isPowered }, // required if isPowered = true (syntax?)
}));

//---------------------------
// EQUIPMENT TYPE
//---------------------------

// ex: tractors, excavators

const equipmentType = invTypeBase.discriminator('equipment_type', new mongoose.Schema({
  category: { type: String, enum: ['Equipment'] },
  fuelType: { type: String, enum: ['Diesel', 'Biodiesel', 'Gasoline', 'Natural Gas', 'Ethanol'], required: true },
}));

module.exports = {
  invTypeBase,
  materialType,
  consumableType,
  reusableType,
  toolType,
  equipmentType,
};
