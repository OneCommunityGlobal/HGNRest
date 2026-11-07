const mongoose = require('mongoose');

module.exports = mongoose.model(
  'SupplierRootCause',
  new mongoose.Schema(
    {
      supplierKey: { type: String, required: true, unique: true },
      tags: [{ type: String, maxlength: 80 }],
    },
    { timestamps: true },
  ),
);
