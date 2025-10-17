// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['student', 'educator'], required: true },
});

module.exports = mongoose.model('User', userSchema);
