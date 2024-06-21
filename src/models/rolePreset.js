const mongoose = require('mongoose');

const { Schema } = mongoose;

const RolePermissionPresets = new Schema({
  roleName: { type: String, required: true },
  presetName: { type: String, required: true },
  permissions: [String],
});

// RolePermissionPresets.createIndex({ roleName: 1, presetName: 1 }, { unique: true });

module.exports = mongoose.model('rolePermissionPresets', RolePermissionPresets, 'rolePermissionPresets');
