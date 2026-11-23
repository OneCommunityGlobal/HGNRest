const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingInventoryUnitSchema = new Schema({
  unit: { type: String, required: true, unique: true },
  category: { type: String, default: 'Material' },
});

module.exports = mongoose.model(
  'buildingInventoryUnit',
  buildingInventoryUnitSchema,
  'buildingInventoryUnits',
);
