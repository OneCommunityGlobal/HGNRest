const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingMaterial = new Schema({
  itemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingInventoryType' },
  project: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingProject' },
  stockBought: { type: Number, default: 0 }, // total amount of item bought for use in the project
  stockUsed: { type: Number, default: 0 }, // total amount of item used successfully in the project
  stockWasted: { type: Number, default: 0 }, // total amount of item wasted/ruined/lost in the project
  stockAvailable: { type: Number, default: 0 }, // bought - (used + wasted)
  purchaseRecord: [{
    _id: false, // do not add _id field to subdocument
    date: { type: Date, default: Date.now() },
    requestedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantity: Number,
    status: { type: String, default: 'Pending' }, // Pending, Rejected, Approved
  }],
  updateRecord: [{
    _id: false,
    date: Date,
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantityUsed: String, // '10 cubic yards'
    quantityWasted: Number,
  }],
});

module.exports = mongoose.model('buildingMaterial', buildingMaterial, 'buildingMaterials');
