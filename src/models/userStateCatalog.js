const mongoose = require('mongoose');

const UserStateCatalogSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    label: { type: String, required: true, unique: true, index: true },
    color: { type: String, required: true, default: '#3498db' },
    order: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

UserStateCatalogSchema.index({ isActive: 1, order: 1 }, { background: true });

module.exports = mongoose.model('user_state_catalog', UserStateCatalogSchema);
