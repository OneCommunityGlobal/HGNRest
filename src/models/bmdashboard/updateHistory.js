const mongoose = require('mongoose');

/**
 * UpdateHistory Schema
 * Tracks all modifications made to consumables (1 entry per update action)
 */
const updateHistorySchema = new mongoose.Schema({
  itemType: {
    type: String,
    enum: ['consumable', 'material', 'reusable', 'equipment', 'tool'],
    required: true,
  },
  itemId: {
    type: mongoose.SchemaTypes.ObjectId,
    required: true,
    ref: 'smallItemBase',
  },
  itemName: {
    type: String,
    required: true,
  },
  projectId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'buildingProject',
  },
  projectName: {
    type: String,
  },
  changes: {
    type: mongoose.Schema.Types.Mixed, // { stockUsed: {old, new}, stockWasted: {old, new}, ... }
    required: true,
  },
  modifiedBy: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'userProfile',
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

updateHistorySchema.index({ itemType: 1, date: -1 });
updateHistorySchema.index({ itemId: 1, date: -1 });

const UpdateHistory = mongoose.model('UpdateHistory', updateHistorySchema, 'updateHistory');

module.exports = UpdateHistory;
