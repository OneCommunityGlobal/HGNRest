const mongoose = require('mongoose');

const KIInventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 50 },
  presentQuantity: { type: Number, required: false },
  storedQuantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  type: { type: String, required: true, trim: true },
  monthlyUsage: { type: Number, required: true },
  reorderAt: { type: Number, required: true },
  category: {
    type: String,
    required: true,
    enum: ['INGREDIENT', 'EQUIPEMENTANDSUPPLIES', 'SEEDS', 'CANNINGSUPPLIES', 'ANIMALSUPPLIES'],
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true, min: Date.now },
  location: { type: String, optional: true },
  onsite: { type: Boolean, default: false },
  lastHarvestDate: { type: Date, optional: true, max: Date.now },
  nextHarvestDate: { type: Date, optional: true, min: Date.now },
  nextHarvestQuantity: { type: Number, optional: true },
});

module.exports = mongoose.model('KIInventoryItem', KIInventoryItemSchema);
