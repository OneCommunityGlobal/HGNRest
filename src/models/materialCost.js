// models/materialCost.js
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    _id:              { type: String, required: true },  // UUID string
    projectId:        { type: String, required: true, index: true }, // “PRJ0001”
    projectName:      { type: String, required: true },
    totalMaterialCost:{ type: Number, required: true }   // store raw dollars
  },
  { collection: 'materialCost', timestamps: true }
);

// Optional: ensure one doc per project
schema.index({ projectId: 1 }, { unique: true });

module.exports = mongoose.model('MaterialCost', schema);
