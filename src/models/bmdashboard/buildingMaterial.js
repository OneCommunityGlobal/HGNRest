const mongoose = require('mongoose');
const { Schema } = mongoose;
const buildingMaterial = new Schema({
  itemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingInventoryType' },
  project: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingProject' },
  stockBought: Number, // total amount of item bought for use in the project
  stockUsed: Number, // total amount of item used successfully in the project
  stockWasted: Number, // total amount of item wasted/ruined/lost in the project
  stockAvailable: Number, // bought - (used + wasted)
  purchaseRecord: [{
    date: { type: Date, default: Date.now() },
    requestedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantity: Number,
    status: { type: String, default: 'Pending' }, // Pending, Rejected, Approved
  }],
  updateRecord: [{
    date: Date,
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantityUsed: String, // '10 cubic yards'
    quantityWasted: Number,
  }],
});
module.exports = mongoose.model('buildingMaterial', buildingMaterial, 'buildingMaterials');
