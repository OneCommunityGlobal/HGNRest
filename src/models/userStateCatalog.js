const mongoose = require('mongoose');

const userStateCatalogSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    color: { type: String, default: 'blue' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('UserStateCatalog', userStateCatalogSchema);
