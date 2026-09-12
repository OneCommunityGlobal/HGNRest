const mongoose = require('mongoose');

const { Schema } = mongoose;

const seedSchema = new Schema({
  name: { type: String, required: true },
  collectedDate: { type: Date, default: Date.now },
  quantityCollected: { type: Number, required: true, min: 0 },
  seedType: { type: String },
  source: { type: String },
  storageLocation: { type: String },
  expiryDate: { type: Date },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('seed', seedSchema, 'seeds');
