const mongoose = require('mongoose');

const { Schema } = mongoose;

const usersSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  mobile: { type: String, required: false },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
});

module.exports = mongoose.model('Users', usersSchema, 'users');
