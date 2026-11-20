const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingSupplier = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('buildingSupplier', buildingSupplier, 'buildingSuppliers');
