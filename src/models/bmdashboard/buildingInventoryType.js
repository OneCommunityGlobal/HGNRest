const mongoose = require('mongoose');
const { Schema } = mongoose;
const buildingInventoryType = new Schema({
  category: { type: String, enum: ['Consumable', 'Material', 'Tool', 'Equipment'], required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  unit: { type: String, required: true }, // unit of measurement
  imageUrl: String,
});
module.exports = mongoose.model('buildingInventoryType', buildingInventoryType, 'buildingInventoryTypes');