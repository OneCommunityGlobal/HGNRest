const mongoose = require('mongoose');

const { Schema } = mongoose;

const treesAndBushesSchema = new Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  plantedDate: { type: Date },
  age: { type: Number },
  condition: {
    type: String,
    enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Dead'],
    default: 'Good',
  },
  treeType: { type: String },
  species: { type: String },
  height: { type: Number },
  notes: { type: String },
  lastMaintainanceDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('treesAndBushes', treesAndBushesSchema, 'treesAndBushes');
