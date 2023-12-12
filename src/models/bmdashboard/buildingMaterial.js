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
    quantity: { type: Number, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
    brand: String,
    status: { type: String, default: 'Pending', enum: ['Approved', 'Pending', 'Rejected'] },
  }],
  updateRecord: [{
    _id: false,
    date: { type: Date, required: true },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    quantityUsed: { type: Number, required: true },
    quantityWasted: { type: Number, required: true },
  }],
});
module.exports = mongoose.model('buildingMaterial', buildingMaterial, 'buildingMaterials');
