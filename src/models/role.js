const mongoose = require('mongoose');

const { Schema } = mongoose;


const Role = new Schema({
  roleName: { type: String, required: true, unique: true },
  permissions: [String],
});

module.exports = mongoose.model('rolesMergedPermissions', Role, 'rolesMergedPermissions');
