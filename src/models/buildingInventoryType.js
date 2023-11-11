const mongoose = require('mongoose');
const { Schema } = mongoose;
const buildingInventoryType = new Schema({
  category: String, // Consumable, Material, Tool, Equipment
  name: String,
  description: String,
  unit: String, // unit of measurement
  imageUrl: String,
});
module.exports = mongoose.model('buildingInventoryType', buildingInventoryType, 'buildingInventoryTypes');