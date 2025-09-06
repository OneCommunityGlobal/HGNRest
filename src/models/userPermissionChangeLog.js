const mongoose = require('mongoose');

const { Schema } = mongoose;

const User = require('./userProfile');

const UserPermissionChangeLog = new Schema({
  logDateTime: { type: String, required: true },
  userId: {
    type: mongoose.Types.ObjectId,
    ref: User,
    required: true,
  },
  individualName: { type: String },
  permissions: { type: [String], required: true },
  removedRolePermissions: { type: [String], default: [] },
  permissionsAdded: { type: [String], default: [] },
  permissionsRemoved: { type: [String], default: [] },
  requestorRole: { type: String },
  requestorEmail: { type: String, required: true },
});

module.exports = mongoose.model(
  'UserPermissionChangeLog',
  UserPermissionChangeLog,
  'UserPermissionChangeLogs',
);
