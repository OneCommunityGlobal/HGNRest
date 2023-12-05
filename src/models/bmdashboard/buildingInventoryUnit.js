const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingInventoryUnit = new Schema({
  unit: String,
  description: String
});

module.exports = mongoose.model('buildingInventoryUnit', buildingInventoryUnit, 'buildingInventoryUnits');
