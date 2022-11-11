const mongoose = require('mongoose');

const { Schema } = mongoose;


const Role = new Schema({
  roleName: { type: String, required: true, unique: true },
  permissions: [String],
  permissionsBackEnd: [String],
});

module.exports = mongoose.model('role', Role, 'role');
