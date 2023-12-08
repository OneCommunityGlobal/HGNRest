const mongoose = require('mongoose');

const baseInv = require('./baseInvSchema');

// inherits all properties of baseInv schema using discriminator
// each document derived from this schema includes key field { __t: "buildingMaterial" }

const buildingMaterial = baseInv.discriminator('buildingMaterial', new mongoose.Schema({
  stockBought: { type: Number, default: 0 }, // total amount of item bought for use in the project
  stockUsed: { type: Number, default: 0 }, // stock that has been used up and cannot be reused
  stockWasted: { type: Number, default: 0 }, // ruined or destroyed stock
  stockAvailable: { type: Number, default: 0 }, // available = bought - (used + wasted/destroyed)
  updateRecord: [{
    _id: false,
    date: { type: Date, required: true },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantityUsed: { type: Number, required: true },
    quantityWasted: { type: Number, required: true },
    test: { type: String, default: 'testing this field' },
  }],
}));

module.exports = buildingMaterial;
