const mongoose = require('mongoose');

const { Schema } = mongoose;


const Permission = new Schema({
  permissionName: { type: String, required: true, unique: true },
  description: { type: String },
});

module.exports = mongoose.model('permission', Permission, 'permission');
