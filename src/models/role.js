const mongoose = require('mongoose');

const { Schema } = mongoose;


const Role = new Schema({
  roleName: { type: String, required: true, unique: true },
  permissions: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'permission' }],
});
module.exports = mongoose.model('role', Role, 'role');
