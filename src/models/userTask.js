const mongoose = require('mongoose');

const userTaskSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['student', 'educator','support'], required: true }, 
  // Add 'support' role
});

module.exports = mongoose.model('UserTask', userTaskSchema, 'usertask');
