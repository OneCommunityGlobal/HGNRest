const mongoose = require('mongoose');
const { Schema } = mongoose;

const User = require('./userProfile');
const rolesMergedPermissions = require('./role')

const PermissionChangeLog = new Schema({
  logDateTime: { type: String, required: true },
  roleId: { 
    type: mongoose.Types.ObjectId, 
    ref: rolesMergedPermissions, 
    required: true 
  },
  roleName: { type: String },
  permissions: { type: [String], required: true },
  permissionsAdded: { type: [String], required: true },
  permissionsRemoved: { type: [String], required: true },
  requestorId: { 
    type: mongoose.Types.ObjectId,
    ref: User
  },
  requestorRole: { type: String },
  requestorEmail: { type: String, required: true},
});

module.exports = mongoose.model('permissionChangeLog', PermissionChangeLog, 'permissionChangeLogs');