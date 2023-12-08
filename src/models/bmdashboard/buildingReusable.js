const mongoose = require('mongoose');

const baseInv = require('./baseInvSchema');

// inherits all properties of baseInv schema using discriminator
// each document derived from this schema includes key field { __t: "buildingReusable" }

const buildingReusable = baseInv.discriminator('buildingReusable', new mongoose.Schema({
  stockBought: { type: Number, default: 0 },
  stockDestroyed: { type: Number, default: 0 },
  stockAvailable: { type: Number, default: 0 },
  updateRecord: [{
    _id: false,
    date: { type: Date, required: true },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantityUsed: { type: Number, required: true },
    quantityDestroyed: { type: Number, required: true },
  }],
}));

module.exports = buildingReusable;
